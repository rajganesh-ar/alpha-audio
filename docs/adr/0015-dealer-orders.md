# ADR 0015 — Dealer orders are their own collection and state machine

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0015-dealer-orders.md`

## Context

Dealers order on account at their own net prices, with VAT added on top. Approvals can come from inside the company (an owner over a purchaser) or from Alpha (credit, margin floor). Storefront orders (ADR 0009) are consumer orders: prices include VAT, payment goes through a gateway, there is no company and no approval. The spec asks for the price trace on each order line, an idempotent `POST /orders`, and credit that counts open orders.

## Decision

1. **A separate `TradeOrders` collection.**
   - Its money is net with VAT beside it, and its lines carry basis, price status and trace. It records the company, who placed it and its approvals.
   - Sharing `Orders` would give the same field (`unitPrice`) two meanings, inclusive and net, and would hang company scope, approvals and credit off a consumer document.
   - Fulfilment of dealer orders joins the ops screens in a later task; confirmed dealer orders hold their stock until then.
2. **`TradeOrderService` owns every status change**, like `CheckoutService` for storefront orders.
   - Statuses: `reserving` → `unavailable` | `pending-approval` | `confirmed`; `pending-approval` → `approving` → `confirmed` | `rejected` | `failed`; `pending-approval` → `cancelled`.
   - Each step is a compare-and-set in SQL. The short `reserving` and `approving` claims make racing submits and approvers safe: the loser is told `in-progress` or `busy`.
3. **Credit is checked under a per-company lock.**
   - Credit used is the gross of the company's orders in `reserving`, `pending-approval`, `approving` and `confirmed` (unpaid invoices join with statements).
   - The check and the insert run under a Postgres session advisory lock (`pg_try_advisory_lock`, polled, on one connection), so parallel orders each see the others.
   - Polling instead of a blocking `pg_advisory_lock` keeps waiters from holding pool connections the lock holder needs.
4. **Approvals are data on the order**: kind (`company` or `alpha`), reason (`threshold`, `credit`, `price`), status, who, when and a note.
   - An owner decides company approvals for their own company. Staff decide Alpha's on `/ops/trade-orders/`. The placer or an owner may cancel while it is pending.
   - A company without a credit line needs Alpha's approval for every order. A purchaser's threshold is compared with the net value.
5. **Stock is held from submit.**
   - All lines or none. Pending orders hold for 72 hours; the ledger's expiry job releases lapsed holds.
   - The last approval confirms the holds, re-reserving any that lapsed, or fails the order `stock-lost`. Rejecting or cancelling releases them.
6. **Idempotency keys are scoped to the company** (`<company>:<key>`), so one company's key can neither collide with nor reveal another's order.

## Consequences

- There are two order collections, and reports that span both read both. That is intended: they differ in money semantics and lifecycle.
- Credit is only released by a cancel or reject until statements record payments. On a long-lived company the limit needs raising by hand until then.
- No notification is sent yet when an order waits for someone; the board and the ops screen show the queue. Emails join with the notifications for dealer events.
