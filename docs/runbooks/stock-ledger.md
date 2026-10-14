# Runbook — stock ledger

The stock ledger is the only source of stock quantities. Read ADR 0004 for how it works; this page is for operating it.

## Ground rules

- **Never edit a quantity.** Stock levels are derived from movements; the admin shows them read-only, and the API, Payload hooks and the database all refuse edits to movements and levels.
- **Corrections are new movements:** a count (`docType = count`, reason required), an adjustment with a reason (write-off, damage), or a transfer.
- **Every change is visible in the admin under Inventory → Ledger explorer** (`/admin/ledger`).

## Looking something up

| Question                                    | Where                                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Where is serial X, and what happened to it? | Ledger explorer → serial number. The table is its full history, oldest first.                                                                 |
| How much of SKU Y is where?                 | Ledger explorer → SKU: levels by location and state, then the latest 500 movements.                                                           |
| What can the website sell?                  | `available` across the market's sellable locations (Locations → "sellable"), less nothing else; reserved stock is already out of `available`. |
| Who changed it?                             | The "By" column (empty means a system job, such as reservation expiry).                                                                       |

## A count does not match

1. Recount the location (blind).
2. Post the variance through the count screen (the stock-count task). It calls `adjustFromCount`, which writes the difference as a `count` movement with the reason you give. A count without a reason is refused.
3. For serialised SKUs, count serial numbers rather than units. Missing serials leave the ledger, unknown ones are booked in, and serials found at the wrong location are moved.

## Reservations look stuck

- Holds expire on their own: carts after 15 minutes, POS after 30 minutes, quotes after 7 days, projects on their own date. Paid orders never expire.
- The `releaseExpiredReservations` job runs every minute on the `ledger` queue. Check **System → Payload Jobs** for recent runs and errors; three attempts with backoff, then the run is marked failed.
- Crons start with the app's first admin or API request after a deploy. If nothing has been requested, open the admin.
- To run it by hand from a shell on the app host: `pnpm --filter @alpha/web payload jobs:run --queue ledger --handle-schedules` (queues the scheduled task, then works the queue).

## An error says "stock_movements is insert-only"

Someone (a script, a migration, a psql session) tried to `UPDATE`, `DELETE` or `TRUNCATE` movements. That is refused by design. Write a correcting movement through the ledger service instead, and fix the script.

## Local development

`pnpm --filter @alpha/web seed:inventory` creates a Dubai warehouse with three locations and some stock and serial history, all through the ledger. It refuses to run in production.
