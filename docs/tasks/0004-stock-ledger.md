# Task 0004 — Stock ledger and reservations in `packages/core`

Phase: P1 Operations core. Depends on: 0001, 0002. Spec: sections 5 (Inventory collections) and 7 (Server logic).

## Goal
An append-only stock ledger with derived levels, serial tracking and a race-safe reservation routine, exposed to Payload as collections and to the app as a service.

## Deliverables
- Collections in `packages/payload/collections/inventory/`: `Warehouses`, `Locations`, `StockMovements` (insert-only access), `StockLevels` (system-written only), `SerialNumbers`, `Reservations`. Migration adds indexes on `(sku, location_id, state)` and a unique index on `serial`.
- `packages/core/ledger/LedgerService.ts`: `move()`, `reserve()`, `release()`, `pick()`, `ship()`, `deliver()`, `adjustFromCount()`, each running in one Postgres transaction with `SELECT … FOR UPDATE` on affected level rows; serialised SKUs move one serial per movement.
- `sellable(sku, market)` = sum of `available` across the market's fulfilment locations.
- Job `releaseExpiredReservations` (every minute): carts 15 min, quotes 7 days, POS 30 min, project allocations per record.
- Admin custom view `LedgerExplorer`: movements for a SKU or serial, levels by location and state.
- Tests: `ledger.invariants.test.ts`, `reservation.concurrency.test.ts` (200 parallel reservations on one SKU with 5 units → exactly 5 succeed, levels never negative), serial uniqueness, expiry job.

## Acceptance criteria
- [ ] Any attempt to update or delete a `StockMovements` row through the admin, REST or Local API (with `overrideAccess: false`) is refused.
- [ ] `StockLevels` cannot be edited in the admin; it is read-only.
- [ ] Concurrency test passes 10 times in a row in CI.
- [ ] Invariant test asserts movements sum to levels for every (sku, location, state) after a randomised sequence of 1,000 movements.
- [ ] A count variance posts as a movement with `docType = count` and a mandatory reason.
- [ ] `LedgerExplorer` shows a serial's full history in order.
