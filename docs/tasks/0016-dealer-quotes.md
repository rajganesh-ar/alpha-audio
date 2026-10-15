# Task 0016 — Dealer quotes: locked prices, held stock, quote to order

Phase: P2 Dealer board. Depends on: 0015 (dealer orders), 0013 (price engine), 0004 (ledger reservations). Spec: Partner API (`/quotes`), Price engine ("Quotes lock FX and prices for their validity"), Stock ledger (quote holds expire after 7 days), Content and data model (`Quotes`), Dealer board rules (a hold blocks checkout but not quoting).

## Goal

A dealer saves the order they are reviewing as a quote instead. It keeps the company's prices, the trace and the FX rates of that moment for seven days, and holds the stock it can for the same time. Within that time the dealer turns it into an order at the locked prices, with the usual rules, credit and approvals, and the quote's stock holds carry over to the order. Rendering the quote as a PDF (Alpha's, then the dealer's white label) is the next task.

## Deliverables

- **`packages/core/quotes`:**
  - `QuoteService` with `create`, `toOrder` and `withdraw`.
    - `create` takes lines priced by the engine for the company now and locks them: unit, basis, status and trace. It records the FX rates used and when. It holds stock line by line for the quote's validity; a line without stock is quoted but not held. Idempotent on the company-scoped key; quoting is allowed on hold.
    - `toOrder` is a compare-and-set from `open` through `ordering` to `ordered`. It refuses an expired quote, then places a dealer order at the locked prices through `TradeOrderService`. The order's rules, credit, approvals and roles apply as for any order. The quote's holds are transferred to the order (re-reserved if they lapsed).
    - `withdraw` releases the holds.
  - `TradeOrderService.submit` accepts the holds a quote already has, per line.
  - Statuses: `open`, `ordering`, `ordered`, `withdrawn`, `expired` (an open quote past its validity is expired the first time it is used).
  - Unit tested to 90%+.
- **`Quotes` collection** (Trade group; migration; number sequence `Q-AE-2026-000001`):
  - Fields: company, created by, market, currency and decimals, VAT rate, status, valid until, FX lock (rates and time), reference (the dealer's project or customer), note, lines, totals, reservations (staff), the order it became, idempotency key and staff notes.
    - Each line carries SKU, product, title, quantity, net unit, net line, VAT, basis, price status, trace and whether it is held.
  - System-written; company users read their own company's quotes; staff read all.
- **`PricingSettings.quoteValidityDays`** (default 7, 1–30), with a migration.
- **`packages/payload/system/quotes`:** `PostgresQuoteStore`, `createQuoteFromDraft`, `orderQuote` and `withdrawQuote`, all reading the company from the session.
- **Partners app:**
  - The order review gets "Save as quote" (with a reference) beside "Place order".
  - `/quotes`: the company's quotes, with validity.
  - `/quotes/{number}`: locked lines and trace, totals, valid until, which lines hold stock, and "Order this quote" and "Withdraw" while it is open. Expired quotes say so and offer to review the lines again at today's prices.
  - Partner API:
    - `GET /api/v1/quotes`;
    - `POST /api/v1/quotes` (idempotent);
    - `POST /api/v1/quotes/{number}/{order|withdraw}`.
- **Tests:**
  - Core unit tests for locking, holds, expiry, conversion races and hold transfer.
  - Integration (`quotes.integration.test.ts`):
    - a quote keeps its prices after a price change and its order uses them;
    - holds move to the order;
    - an expired quote is refused;
    - quoting is allowed on hold but ordering is not;
    - company isolation.
  - End to end: save a quote from the review, then order it; withdraw a quote.
- **Docs:** ADR 0016 (quotes lock prices and hold stock; quote to order reuses the order service), runbook `dealer-quotes.md`.

## Acceptance criteria

- [x] A quote keeps the company's prices, trace and FX for its validity, even if prices change meanwhile.
- [x] A quote holds the stock it can until it expires; the holds carry over when it becomes an order.
- [x] Ordering a quote applies the company's order rules, credit and approvals at the locked prices; an expired or withdrawn quote cannot be ordered, and a quote becomes at most one order.
- [x] An account on hold can quote but not order.
- [x] A company never sees another company's quotes.
