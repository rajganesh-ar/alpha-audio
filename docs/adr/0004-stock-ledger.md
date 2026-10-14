# ADR 0004 — Stock ledger: rules in core, locks in Postgres, guards in three layers

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0004-stock-ledger.md`

## Context

Stock is a ledger, never a field (CLAUDE.md rule 1). Every quantity is derived from insert-only `StockMovements`. `StockLevels` must always equal the sum of movements, reservations must never oversell under concurrency, and serialised units must have exactly one current place. The spec (Server logic → Stock ledger) fixes the states, the reservation expiry times and the rule that a count variance is a reasoned movement.

## Decision

### 1. Rules in `packages/core`, storage behind a port

`LedgerService` (`packages/core/src/ledger`) holds every rule: states, which documents may bring stock in or take it out, serial handling, reservations, counts and expiry. It depends only on the `LedgerStore`/`LedgerTx` interface. `MemoryLedgerStore` runs the unit tests, so `packages/core` stays pure and keeps its coverage bar (99 % of lines). `PostgresLedgerStore` (`packages/payload/src/system/ledgerStore.ts`) is the production store; `createLedger(payload)` wires it.

### 2. One transaction per operation, level rows locked in a fixed order

Each operation runs as one Drizzle transaction:

1. It upserts the level rows it touches (`INSERT … ON CONFLICT DO NOTHING`), so even a level that does not exist yet has a row to lock.
2. It takes `SELECT … FOR UPDATE` on those rows, always ordered by `(sku, location_id, state)`. `reserve()` locks its `available` and `reserved` rows in one call for the same reason.
3. It checks the rules against the locked quantities.
4. It inserts the movements and writes the new levels.

Concurrent reservations queue on the level row's lock instead of overselling, and the shared lock order rules out level-row deadlocks. Expiry uses `FOR UPDATE SKIP LOCKED`, so overlapping job runs share the work.

### 3. Movements are created only by the ledger service

The spec lists "ops / ops (create only)" for `StockMovements`. Creating a movement through the Payload API would bypass the level update and break the invariant. So Payload `create` access is refused as well, and the ops screens (receiving, counts, transfers; P1 tasks) will call `LedgerService` through `/api/v1/*` route handlers with the right role.

### 4. Three layers of refusal

| Layer                                                                                                 | Stops                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payload access (`nobody` for create, update, delete on the four ledger-owned collections; staff read) | Admin, REST, GraphQL, Local API with `overrideAccess: false`                                                                                                                                   |
| `beforeChange` / `beforeDelete` hooks that always throw 403                                           | A Local API call with `overrideAccess: true` (Payload runs hooks regardless)                                                                                                                   |
| Postgres (migration `ledger_constraints`)                                                             | Raw SQL: a trigger refuses `UPDATE`, `DELETE` and `TRUNCATE` on `stock_movements`; `CHECK`s keep levels whole and ≥ 0, movements positive, whole and state-changing, serial movements one unit |

The ledger's own writes go straight to the tables through Drizzle, so they meet only the database layer, which they satisfy by construction.

### 5. Serialised or bulk, decided by the SKU's first movement

There is no Products collection yet to carry a `serialised` flag. A SKU's mode is set by its first movement: with a serial, it is serialised; without one, it is bulk. After that, every movement must match. When Products lands, its flag replaces this inference. Until then, two simultaneous first receipts of a brand-new SKU in different modes are the one unguarded case.

### 6. Reservations hold one location's stock

`reserve()` takes the exact quantity at one location, the first in the market's fulfilment set (sellable, active, by `priority`) that has enough, or reserves nothing. Splitting an order across locations is left to the order task.

### 7. Expiry as a scheduled Payload task

`releaseExpiredReservations` is a Payload task with `schedule: [{ cron: '0 * * * * *', queue: 'ledger' }]`. `jobs.autoRun` works that queue every minute inside the app process; Payload starts its crons on the first admin or API request. Hold times are in core: cart 15 minutes, POS 30 minutes, quote 7 days. Project allocations must give their own expiry, and paid orders do not expire.

### 8. LedgerExplorer

LedgerExplorer is an admin view at `/admin/ledger`, with a link after the collection links. A SKU shows its non-zero levels and its latest 500 movements; a serial shows its full history in write order. Custom admin views are public by default in Payload, so the view redirects anyone who is not staff to the login page and reads with the user's own access rules.

## Consequences

- **Cross-location moves are two movements** (out of one location, into the other) in one transaction, so the "single location per movement" model of the spec holds.
- **The `ON DELETE SET NULL` foreign keys from `stock_movements` can never fire:** the trigger refuses the update. Locations and users with ledger history cannot be deleted (locations already refuse deletes; users will be archived when roles arrive).
- **Payload names compound indexes after their fields** (`sku_location_state_idx`, `status_expiresAt_idx`), not their tables. A future collection indexing the same field names would collide; give it different field names or rename in a hand-written migration.
- **Integration tests use `apps/web/tests/integration`**, as since task 0001, because the Payload config lives in the app. CLAUDE.md now says so.
- **Roles are still "any staff user"** until the access-control task; ledger reads are staff-only and writes go through the service.
