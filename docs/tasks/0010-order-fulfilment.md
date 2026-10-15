# Task 0010 — Order fulfilment and customer notifications

Phase: P1 Operations core / P2 Storefront. Depends on: 0004 (ledger), 0009 (orders). Spec: Server logic → Stock ledger, Checkout state machine (`confirmed → picking`); Content and data model (Shipments, Payments); APIs → jobs (`sendNotification`); Page specifications (Warehouse PWA: Pick, Dispatch; My Alpha: orders and tracking).

## Goal

Staff take a confirmed web order from the queue to the customer's door: pick it, ship it with a tracking number, and mark it delivered. They can cancel an order that has not shipped, which puts the stock back and refunds the payment. The customer gets an email at each step and can follow the order on a page linked from those emails. Courier integration (Aramex, SMSA) is an open decision (spec: Delivery), so shipments are recorded by hand with the courier's name and tracking number; a courier adapter comes later.

## Deliverables

- **Ledger** (`packages/core/ledger`):
  - `shipReservation`: `picked → shipped` for exactly the reservation's units and serials, then reservation status `shipped`.
  - `deliverReservation`: `shipped → delivered`, then reservation status `delivered`.
  - `returnToStock`: a picked reservation goes back to `available`, then status `released`.
  - Each refuses a reservation in the wrong status, so nothing can be shipped twice.
  - Migration for the new reservation statuses.
- **`packages/core/fulfilment`:** `FulfilmentService` over a store port.
  - Statuses: `awaiting → picking → picked → shipped → delivered`, plus `cancelled`.
  - Compare-and-set transitions. Steps are idempotent and resumable after a crash.
  - Only confirmed orders can be fulfilled.
  - Cancel works before shipment: it releases or returns the holds, then refunds through the payment port.
  - `refund` also covers failed `stock-lost` orders.
  - Unit tested over memory stores.
- **Payments port:** `refund(intentId, amount, idempotencyKey)`. The sandbox refunds at once; a provider without refunds leaves the refund `manual` for staff.
- **Collections** (migration included):
  - `Shipments`: number `SH-2026-000001`, order, courier, tracking number and URL, status, timestamps, lines. Staff read; system writes.
  - `Notifications`: an outbox. The key is unique (`order:template`); also order, channel, template, recipient, locale, status, attempts, last error, sent at. Staff read; system writes.
  - `Orders` gains: fulfilment status, refund (status, amount, reference), cancel reason, and the shipment link.
- **Job `sendNotification`** (queue `notifications`): retries with exponential backoff and marks the outbox row.
  - Email goes through Payload's email adapter: nodemailer on `SMTP_URL` when set (Mailpit locally), otherwise logged. The sender is `EMAIL_FROM`.
  - Templates are order confirmed, shipped, delivered and cancelled, in `en` and draft `ar`, with totals from core and the order link carrying its access token.
- **Ops screens** (`/ops/…`, staff session, `private, no-store`, work without JavaScript):
  - Order queue by fulfilment status.
  - Order detail with lines, the locations and serials to pick, contact and address, and Pick, Ship (courier and tracking), Delivered and Cancel (reason) forms.
  - Handlers: `/api/v1/ops/orders/{number}/{pick|ship|deliver|cancel|refund}`. Staff only, same-origin, Zod-validated.
- **Customer order page** `/{m}/{l}/orders/{number}/?token=…`: status timeline, shipment and tracking link, lines and totals. Shown only with the token. `noindex`.
- **UI component:** `OrderTimeline`, with five stories, axe, and LTR/RTL snapshots.

## Acceptance criteria

- [x] Pick moves every line `reserved → picked`, ship moves `picked → shipped`, and delivered moves `shipped → delivered`, by reservation, serials included. Ledger invariants hold, and a repeated or concurrent action changes nothing.
- [x] Only confirmed orders can be picked. Ship needs picked, and delivered needs shipped. Each refusal is explained.
- [x] Cancelling before shipment returns every unit to `available` and refunds the full amount (sandbox). An order that has shipped cannot be cancelled.
- [x] A refund that cannot be made automatically is recorded as `manual` for staff, never lost.
- [x] Confirmation, shipped, delivered and cancelled emails are queued once per order and step (outbox key), sent by the job with retries, and carry the order link. The link opens the order page only with its token.
- [x] Ops screens and handlers refuse anonymous and cross-site requests. Shipments and notifications cannot be read anonymously.
- [x] Playwright: an order bought in `ae/en` is picked, shipped and delivered on the ops screens, and the customer's order page shows each step. The new component passes the five-story check, axe and visual snapshots.
