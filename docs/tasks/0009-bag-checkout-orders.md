# Task 0009 — Bag, checkout and orders (sandbox payments)

Phase: P2 Storefront (brought forward on request). Depends on: 0004 (reservations), 0006–0008 (catalogue, sale rule). Spec: Server logic → Checkout state machine; APIs (`/bag`, `/checkout/*`, inbound webhooks); Content and data model (Carts, Orders, Payments); GCC market layer (money, payment rails, address scheme); Page specifications (Bag, Checkout, Confirmation).

## Goal

A shopper in `ae/en` or `ae/ar` can add products to a bag, check out with contact and address details, pay, and get a confirmed order. Stock is held for 15 minutes from checkout and converted to an order hold on payment. The card gateway is an open decision (spec: Delivery), so payments go through a provider port with a sandbox provider; the real gateway is a later adapter.

## Deliverables

- **Collections** (migration included):
  - `Carts` (system-written): token hash, market, locale, lines (sku, product, qty, price snapshot), checkout draft, status (`open` | `converted`), expiresAt (7 days).
  - `Orders`:
    - number from a database sequence (`AE-2026-000001`), channel `web`, market, currency, decimals, locale;
    - contact, address per the market's scheme, payment method;
    - lines (sku, title, qty, unit price, line total, VAT);
    - totals (subtotal incl. VAT, VAT, delivery, total), status, payment (provider, intent, status), reservation ids;
    - idempotency key (unique) and access token (hashed).
  - `WebhookEvents`: provider, event id (unique per provider), payload hash, received at.
  - Access: carts and webhook events are system only; orders are staff-read; nothing is deleted.
- **`packages/core/checkout`:**
  - Line pricing from `consumerPrice`, refusing lines not on sale, price on request, or a quantity outside 1–10.
  - VAT per line, summed, never on the total.
  - The checkout state machine as a `CheckoutService` over a store port:
    - `start`: idempotent on the key; reserves every line for 15 minutes or none; creates the payment.
    - `handlePaymentEvent`: deduplicated by event id; amount and currency checked; on capture the cart holds become order holds, and on decline they are released.
    - `expire`.
  - Unit tested over memory stores.
- **`LedgerService.confirm`:** moves an active reservation to another document and expiry (cart → order), atomically; it refuses an expired one.
- **Payment provider port** (`packages/core/payments`) with a sandbox provider: HMAC-signed redirect and webhook, `card` only. Selected by `PAYMENT_PROVIDER`; refused in production unless `PAYMENT_SANDBOX_ALLOWED=true` (staging).
- **Route handlers under `/api/v1/markets/{m}/…`:**
  - `bag/lines` (POST, form or JSON);
  - `checkout` (POST);
  - sandbox pay and decline;
  - `/api/webhooks/{provider}`.
    All are same-origin checked, Zod-validated, `private, no-store`. The cart id lives in an httpOnly, SameSite=Lax cookie.
- **Pages** (dynamic, `noindex`), all working without JavaScript:
  - `/{m}/{l}/bag/`: live prices, quantity and remove, totals with VAT share, a price-changed notice, an empty state.
  - `/{m}/{l}/checkout/`: contact, address fields from the market's address scheme, payment methods from the market record intersected with the provider, summary.
  - `/{m}/{l}/checkout/return/`: confirmed, waiting (meta refresh) or failed.
  - The sandbox payment page.
  - The product page gets an add-to-bag form.
- **Components**, each with five stories, axe and LTR/RTL snapshots: `BagLine`, `OrderSummary`, `CheckoutSection`, `PaymentMethodList`.
- **Job** `expireCheckouts` (every minute): orders still paying after their holds expired become `expired`.
- **Playwright e2e** (`apps/web/e2e/checkout.spec.ts`): checkout in `ae/en` and `ae/ar` against a seeded local app.

## Acceptance criteria

- [x] Add to bag, change quantity and remove work with JavaScript disabled; bag totals show VAT as `total × rate ÷ (100 + rate)` per line, summed; prices are re-resolved on every view and a changed price is announced.
- [x] Checkout reserves every line for 15 minutes or none: if one line has no stock, nothing stays reserved and the shopper sees which line failed.
- [x] Submitting checkout twice (double click, back and resubmit) creates one order and one payment (idempotency key).
- [x] A captured payment confirms the order and turns the cart holds into order holds with no expiry; a duplicate or replayed webhook changes nothing; a declined payment releases the stock and marks the order failed; an amount or currency mismatch is refused.
- [x] Holds that expire before payment leave the order `expired` via the job; a late capture on an expired order re-reserves if it can, else marks the order failed for refund.
- [x] Orders, carts and webhook events cannot be read anonymously; an order is shown to the shopper only with its access token.
- [x] Playwright checkout passes in `ae/en` and `ae/ar`; the new components pass the five-story check, axe and visual snapshots.
