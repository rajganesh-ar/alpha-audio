# ADR 0010 — Fulfilment by reservation, refunds through the port, notifications through an outbox

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0010-order-fulfilment.md`

## Context

Confirmed web orders (ADR 0009) have to reach the customer. The warehouse has to pick, ship and deliver them; staff need to cancel and refund before shipment; and customers need an email at each step plus a page to follow the order. The courier integration (Aramex, SMSA) is still an open decision, and email is the first notification channel; WhatsApp and SMS come later.

## Decision

1. **Stock follows the order's reservations.**
   - `LedgerService` gains `shipReservation` (`picked → shipped`), `deliverReservation` (`shipped → delivered`) and `returnToStock` (`picked → available`).
   - Each one moves exactly the reservation's units and serials, records the movement against the shipment, and advances the reservation's status (`shipped`, `delivered` and `released`; migration `fulfilment`).
   - Each refuses a reservation in the wrong status, so a unit is never shipped twice and nobody chooses which serial goes out by hand.
2. **Fulfilment is its own state machine** (`packages/core/fulfilment`, `FulfilmentService`), beside the checkout status.
   - Statuses: `awaiting → picking → picked → shipping → shipped → delivering → delivered`, plus `cancelling → cancelled`.
   - The `-ing` states are claims taken by compare-and-set. A ship and a cancel can never interleave.
   - The same action resumes an interrupted claim: holds already moved are skipped, and a concurrent duplicate of a step is a no-op.
   - Only `confirmed` orders are fulfilled.
3. **Cancellation is allowed until shipment**, and the refund goes through the payment port.
   - Cancelling releases the holds, or returns picked units to the shelf.
   - The refund then runs through `PaymentProvider.refund` with the idempotency key `refund:{order}`.
   - A provider without refunds leaves the refund `manual`, and a provider error leaves it `failed` (retryable). The refund is never lost and never paid twice (refund status claim, plus a CHECK that the amount ≤ the total).
   - The same refund covers paid orders that failed as `stock-lost`.
   - After shipment, the return-and-refund path is an RMA (later task).
4. **One shipment per order** for now: the `shipments.order` column is unique and numbers come from `shipment_number_seq`.
   - Staff type the courier and tracking number.
   - A courier adapter will create the shipment and its label, and move it to `delivered` from courier webhooks, without changing the service.
5. **Customer notifications go through an outbox.**
   - A `Notifications` row is written once per order and template (unique key `order:template`), then a `sendNotification` job (queue `notifications`) delivers it with exponential backoff.
   - Each attempt is recorded. After five failures the row is `failed` for the dead-letter review.
   - Email goes through Payload's email adapter: nodemailer on `SMTP_URL`, or the log when it is unset. The sender is `EMAIL_FROM_ADDRESS` / `EMAIL_FROM_NAME`.
   - Copy is in `packages/payload/notifications` (en, plus ar as a draft). It renders as plain HTML and text with `lang` and `dir`, and its money comes from core.
6. **The order link is derived, not stored.**
   - `orderAccessToken(payload, idempotencyKey)` is an HMAC under the instance secret. The checkout, a resubmit and the notification job therefore all produce the same link, and the order stores only its hash.
   - The customer order page `/{m}/{l}/orders/{number}/?token=…` shows progress, the shipment and the refund.
7. **The ops screens live outside the market tree**, at `/ops/…` in the `(ops)` route group with its own root layout.
   - They use the Payload staff session; without one, they prompt sign-in through `/admin/login`.
   - They are plain forms that work without JavaScript, and post to `/api/v1/ops/orders/{number}/{action}`.
   - They are English-only for now; every string still comes from the dictionary.

## Consequences

- Picking is whole-order. Scanning line by line and an offline queue belong to the warehouse PWA task.
- Split shipments, partial cancellation and returns need RMAs and a shipments-per-order model change; the unique index makes that a deliberate migration.
- The warranty is registered at delivery (spec: `registerWarranty`) once Customers and Warranties exist. `delivered` is where it will hook in.
