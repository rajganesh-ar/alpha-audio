# ADR 0016 — Quotes lock prices and hold stock; ordering a quote reuses the order service

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0016-dealer-quotes.md`

## Context

Dealers quote their own customers and need Alpha's price to stand while the customer decides. The spec says quotes lock FX and prices for their validity, quote holds expire after seven days, and a hold blocks checkout but not quoting. A quote that becomes an order must not be priced twice or hold its stock twice.

## Decision

1. **A `Quotes` collection** holds, for each line, the engine's outcome at quoting time: unit, basis, price status and trace.
   - It also records the FX rates the engine used (AED per unit, from PricingSettings) with the time.
   - The validity comes from `PricingSettings.quoteValidityDays` (default 7, at most 30).
   - The rates and the ledger reservation ids are staff-only fields; the company sees its locked prices and which lines hold stock.
2. **Stock is held line by line** with ledger reservations of type `quote` expiring at the validity. A line that cannot be held is still quoted, marked "not held". The ledger's expiry job releases lapsed holds, as it does for carts.
3. **`QuoteService.toOrder` places a dealer order through `TradeOrderService`.**
   - The order is placed at the locked lines, with the quote's holds passed in. `submit` moves each hold to the order (`ledger.confirm`) or reserves afresh when one lapsed.
   - The order's idempotency key is the quote's, so a retry finds the same order.
   - Order rules, hold, roles, credit and approvals are the order service's, applied at the locked prices.
   - A compare-and-set from `open` through `ordering` to `ordered` makes a quote become at most one order; if the order is refused, the quote returns to `open`.
4. **Expiry is lazy.** An open quote past its validity reads as expired, and becomes `expired` (releasing anything still held) the first time someone tries to order it. Its holds have already lapsed in the ledger, so no job is needed.
5. **Rendering a PDF is separate** (next task). Quote data has no cost or rule inputs, so any renderer can take it as it is.

## Consequences

- Locked prices can be below today's margin floor or above today's contract. That is the point of a quote, and the line's `needs-approval` status is carried, so Alpha still approves a below-floor price.
- A quote ordered after its holds lapsed may find the stock gone; the dealer is told and the quote stays open.
- A crash between the claim and the order leaves a quote in `ordering`; the runbook covers the repair.
