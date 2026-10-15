# ADR 0009 — Checkout: a state machine over the ledger, payments behind a port

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0009-bag-checkout-orders.md`

## Context

The storefront takes its first orders. The checkout has to hold stock for the shopper while they pay, survive double clicks, back-and-resubmit, slow and replayed webhooks, and a payment that arrives after the hold lapsed. The card gateway is still an open decision (spec: Delivery), so the payment side has to be pluggable. Shoppers are anonymous: no account, and no buyer context from the request (CLAUDE.md rule 3).

## Decision

1. **The bag is a cart behind an httpOnly cookie.**
   - The cookie is `alpha_bag_{market}`: httpOnly, SameSite=Lax, Secure on https, seven days. There is one bag per market, since prices, VAT and rights differ.
   - The browser holds a random 256-bit token; `Carts` stores only its SHA-256. Carts are system-only (no Payload read even for staff), because the draft holds the shopper's contact and address.
   - Lines carry a price snapshot only to announce a change. Every view and the checkout price the bag again from the catalogue (`priceBag` in `packages/core/checkout`). VAT is computed per line as `total × rate ÷ (100 + rate)` and then summed.
2. **The checkout is a state machine in `packages/core`** (`CheckoutService` over a `CheckoutStore` port).
   - States: `reserving → paying → confirming → confirmed`, plus `unavailable`, `failed` and `expired`.
   - Every transition is a compare-and-set in SQL (`UPDATE … WHERE status IN (…)`). Whoever wins a transition owns the next step, so no lock is held across the payment call.
   - `start` holds every line for 15 minutes, or none: when one line is short, the holds already taken are released and the order records which SKUs failed.
3. **Idempotency comes from the order, not the request.**
   - The checkout form carries a fresh key on each rendering. The order's unique `idempotency_key` is `sha256(cart, form key, bag fingerprint)`.
   - Resubmitting the same form for the same bag finds the same order and the same payment intent: the sandbox intent is an HMAC of the key, and real gateways get the key as their idempotency key.
   - A changed bag is a new order, so a shopper is never charged for a bag they no longer see. The previous order's holds then lapse with the job.
   - A concurrent twin that loses the unique index is sent to the order's result page, which refreshes itself.
4. **Payment confirms stock in place.**
   - `LedgerService.confirm` re-targets an active cart hold to the order with no expiry, in one ledger transaction. It refuses a hold that has already expired.
   - A late capture on an expired order holds the stock again if it is there. Otherwise the order is `failed` with reason `stock-lost`, for a refund.
   - A decline, a failure or an amount or currency mismatch releases the holds.
5. **Webhooks are deduplicated before anything else.**
   - `WebhookEvents` has a unique `(provider, event_id)`. Inserting the event is the first step, and a conflict is reported as `duplicate`.
   - Webhooks are authenticated by the provider's signature, not by Origin (a server calls them).
6. **Payments sit behind a port** (`packages/core/payments`).
   - The `SandboxPaymentProvider` lives in `packages/payload`, because it needs `node:crypto` and core stays browser-safe. It signs its redirect links and events with HMAC-SHA256, as real gateways do, and its hosted page is part of this app.
   - `PAYMENT_PROVIDER` selects the provider. The sandbox is refused under `NODE_ENV=production` unless `PAYMENT_SANDBOX_ALLOWED=true` (staging); otherwise checkout says online payment is unavailable.
   - The refusal happens when the provider is created, not in the env schema, because `next build` itself runs as production.
7. **Shoppers see their order only with its access token.**
   - The confirmation link carries a token: an HMAC of the idempotency key under `PAYLOAD_SECRET`, so a resubmit links to the same order. Only its hash is stored, and the comparison is constant-time.
   - Orders are staff-read, system-written, and never deleted.
8. **Everything works without JavaScript.** Add, quantity, remove, checkout, Pay and Decline are plain forms. Handlers answer `303 See Other` to the page that shows the outcome; refusals carry a `status` code in the query and the form is refilled from the cart's draft. Shopper pages are `force-dynamic` and `noindex`. POST handlers refuse cross-site requests (`Origin` / `Sec-Fetch-Site`).

## Consequences

- Delivery is free, because shipping zones are not modelled yet. The `delivery` total exists and is zero.
- Abandoned carts and failed orders accumulate. Purging expired carts belongs to the data-retention job (later task). Orders are kept for the record.
- The real gateway is an adapter implementing `PaymentProvider` (create, parse webhook) plus its hosted or embedded page. Nothing in the checkout changes.
- Payment rails shown are the market's `payments` intersected with what the provider takes. With the sandbox, that is `card` only.
- Order confirmation email and the order-to-fulfilment hand-off are later tasks. `confirmed` is the state they start from.
