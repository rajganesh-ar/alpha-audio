# Task 0015 — Dealer orders: order rules, credit and approvals

Phase: P2 Dealer board. Depends on: 0013 (companies, price engine), 0014 (partners app), 0004 (ledger reservations). Spec: Dealer board rules (credit, hold, order rules), Price engine (margin floor → approval), Partner API (`/orders`, idempotent POST), Testing (end to end: dealer order with approval).

## Goal

A dealer places an order on account from the dealer board at their own prices. The order rules are checked and explained inline, stock is held, and the order goes through the approvals it needs before it is confirmed:

- the company's owner approves orders above a purchaser's threshold;
- Alpha approves orders over the credit limit or with a price below the margin floor.

Accounts on hold cannot order. Invoicing, statements and dealer delivery addresses are later tasks.

## Deliverables

- **`packages/core/tradeOrders`:**
  - `checkOrderRules(lines, settings)`: refuses unavailable products, quantities that are not a multiple of the company's order multiple, and a net value under its minimum order value. Each problem is named for the line or order it concerns.
  - `approvalsFor(...)`: the approvals an order needs. `company/threshold` when the placer is a purchaser with a threshold below the order's gross. `alpha/credit` when credit used + gross exceeds the limit. `alpha/price` when a line is `needs-approval`.
  - `creditPosition(limit, used)`.
  - `TradeOrderService` with `submit`, `approve`, `reject` and `cancel`. Every status change is a compare-and-set. Submits are idempotent on the company's idempotency key; credit is checked under a per-company lock, so parallel orders cannot overspend it together.
    - Statuses: `pending-approval`, `confirmed`, `rejected`, `cancelled`, `failed` (stock lost).
    - Stock is reserved at submit for every line, all or none. Pending orders hold it for 72 hours; on the last approval the holds are confirmed, or re-reserved if they lapsed, else the order fails with `stock-lost`. Rejecting or cancelling releases them.
  - Unit tested to 90%+.
- **`TradeOrders` collection** (Trade group; migration; number sequence `T-AE-2026-000001`):
  - Fields: company, placed by, market, currency and decimals, VAT rate, status, PO reference, the dealer's note, lines, totals, approvals, reservations, hold expiry, failure reason, the reject or cancel reason, idempotency key and staff notes.
    - Each line carries SKU, product, title, quantity, net unit, net line, VAT, basis, status and trace (without internal steps).
    - Totals are net, VAT and gross.
    - Each approval records kind, reason, status, who and when.
  - System-written; staff read all and may edit staff notes; company users read their own company's orders only.
- **`packages/payload/system/tradeOrders`:**
  - `PostgresTradeOrderStore`, with an advisory lock per company.
  - `placeTradeOrder`, `previewTradeOrder`, `decideTradeOrder` (an owner decides company approvals for their own company; staff decide Alpha approvals) and `cancelTradeOrder` (the placer or an owner, while pending).
  - `tradeCredit` (limit, used, available).
  - Everything reads the company from the session.
- **Partners app:**
  - Catalogue rows get an "Order" link.
  - `/orders/new`: a quick-order form (SKU and quantity rows) and a review. The review shows priced lines with the trace, rule problems inline, the approvals the order will need, the credit position, a PO reference and a note. It works without JavaScript (a GET review, then a POST with an idempotency key).
  - `/orders`: the company's orders.
  - `/orders/{number}`: lines, totals and approvals, with approve and reject for owners and cancel while pending.
  - Viewers and installers can browse but not order. An account on hold sees why it cannot order.
  - Partner API:
    - `GET /api/v1/orders`;
    - `POST /api/v1/orders` (idempotent on `idempotencyKey`);
    - `POST /api/v1/orders/{number}/{approve|reject|cancel}`.
- **Web ops:** `/ops/trade-orders/` lists orders waiting for Alpha, with approve and reject (with a reason), through `POST /api/v1/ops/trade-orders/{number}/{action}` (staff session).
- **UI:** `QuickOrder` and `CreditMeter`, each with the five stories; the catalogue table gains an optional order link.
- **Seed:** `seed:trade` adds:
  - a purchaser with a threshold;
  - Gulf Integrators' order rules (order multiple 2, minimum order AED 5,000);
  - more credit for Harmony.

  `seed:e2e` tops up the stock the dealer suite orders.

- **Tests:**
  - Core unit tests for rules, approvals, credit and every transition, including races.
  - Integration (`trade-orders.integration.test.ts`):
    - placing, idempotency, 20 parallel orders against one credit limit, the hold;
    - approvals by owner and staff, refusal of the wrong approver;
    - cancel and reject releasing stock;
    - company isolation of orders.
  - End to end:
    - an owner orders and it is confirmed;
    - a purchaser's order needs the owner's approval, who approves it;
    - an order-rule failure is explained;
    - a viewer cannot order.
- **Docs:** ADR 0015 (trade orders are their own collection and state machine), runbook `dealer-orders.md`.

## Acceptance criteria

- [x] An owner's order within credit with normal prices is confirmed at once and holds its stock.
- [x] A purchaser's order above their threshold waits for an owner's approval and is confirmed when approved; a rejected or cancelled order releases its stock.
- [x] An order over the credit limit or with a below-floor price waits for Alpha's approval, and only staff can give it.
- [x] Parallel orders never overspend the credit check: each one sees the credit the others already used.
- [x] Order multiple and minimum order value failures are explained inline and nothing is reserved.
- [x] An account on hold cannot order; viewers and installers cannot order.
- [x] Resubmitting with the same idempotency key returns the same order.
- [x] A company never sees another company's orders, through the board, the API or the Local API.
