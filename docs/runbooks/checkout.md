# Runbook — bag, checkout and orders

How a storefront order comes to be, and what to check when one looks wrong. Read ADR 0009 for the design.

## The path of an order

1. **Bag.** The shopper adds products from the product page. The bag lives in the `alpha_bag_{market}` cookie (one bag per market) and in **Carts**, which is system-only and not visible in the admin. Every view of the bag prices it again from the catalogue. If a price moved since the line was last changed, the line says so.
2. **Checkout.** Contact details, then the address fields of the market's scheme (Markets → address scheme), then a payment method. The methods shown are the market's payment rails that the provider takes (with the sandbox, card only). Submitting holds every line for 15 minutes, or none, and creates the order (status `paying`) and its payment.
3. **Payment.** The provider's page takes the payment and the provider calls `/api/webhooks/{provider}`. A capture confirms the order and turns the holds into order holds with no expiry. A decline marks the order `failed` and releases the stock.
4. **Confirmation.** The shopper returns to `/checkout/return/?order=…&token=…`. Only that link shows the order. The bag is closed once the order is confirmed.

## Order statuses

| Status        | Meaning                                                           | Stock                         |
| ------------- | ----------------------------------------------------------------- | ----------------------------- |
| `reserving`   | Holding stock (seconds)                                           | being held                    |
| `unavailable` | A line had no stock; `unavailableSkus` says which                 | nothing held                  |
| `paying`      | Waiting for the payment                                           | held for 15 minutes           |
| `confirming`  | A capture arrived; holds are being moved to the order (seconds)   | moving                        |
| `confirmed`   | Paid                                                              | held for the order, no expiry |
| `failed`      | `declined`, `payment-error`, `amount-mismatch` or `stock-lost`    | released                      |
| `expired`     | The holds lapsed before payment (`expireCheckouts`, every minute) | released                      |

## When something goes wrong

| Symptom                                     | Why                                                                    | Do                                                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Order `failed` with `stock-lost`            | The payment arrived after the hold lapsed, and the stock had sold      | Refund in full from the gateway; tell the shopper. Stock is not held.                                                            |
| Order `failed` with `amount-mismatch`       | The gateway reported a different amount or currency                    | Do not ship. Check the gateway transaction and refund it; investigate how the amounts differed.                                  |
| Order stuck in `paying` beyond 15 minutes   | The `expireCheckouts` job is not running                               | Check the jobs queue (`ledger`) and the dead-letter view; the job expires orders whose holds lapsed.                             |
| Order stuck in `confirming` or `reserving`  | The process died mid-step                                              | Compare the order's reservations in the Ledger explorer with its lines, then escalate to engineering. Do not edit stock by hand. |
| Shopper says they paid twice                | Two orders (different bags) or a gateway retry                         | One order per idempotency key; search Orders by email. A second capture on one intent is ignored (`already-confirmed`).          |
| Webhook returns 401                         | The signature does not verify (wrong secret, or not from the gateway)  | Check `PAYMENT_SANDBOX_SECRET` (or the gateway's secret) matches on both sides                                                   |
| Checkout says online payment is unavailable | Production with the sandbox provider and `PAYMENT_SANDBOX_ALLOWED` off | Expected on production until a real gateway exists; on staging set `PAYMENT_SANDBOX_ALLOWED=true`                                |

Webhook events are recorded in **Webhook events** (system-only) with their payload hash. A replayed event is answered `duplicate` and changes nothing.

## Sandbox payments (development and staging)

- `PAYMENT_PROVIDER=sandbox`. Under `next start` or in production builds, also set `PAYMENT_SANDBOX_ALLOWED=true`.
- The sandbox page (`/{m}/{l}/checkout/sandbox/{intent}/`) shows the order and amount, with **Pay** and **Decline** buttons. They post a signed event to the webhook handler, as a gateway would.
- `PAYMENT_SANDBOX_SECRET` signs the links and events. If it is left empty, it is derived from `PAYLOAD_SECRET`.

## End-to-end tests

```
pnpm --filter @alpha/web seed:markets   # then seed:inventory, seed:purchasing, seed:catalog
pnpm --filter @alpha/web seed:e2e       # keeps 20 Lumina II sellable in ae; re-run before each suite
pnpm --filter @alpha/web build
pnpm test:e2e                           # starts next start unless E2E_BASE_URL is set
```

The suite runs with JavaScript disabled. It buys in `ae/en` and `ae/ar`, declines once, and submits invalid details once.
