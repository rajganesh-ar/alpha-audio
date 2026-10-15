# Runbook — order fulfilment

How a confirmed order goes from the queue to the customer, and what to do when a step fails. Read ADR 0010 for the design and the [checkout runbook](checkout.md) for how orders are placed.

## Daily flow (ops screens)

1. Sign in at `/admin`, then open **`/ops/orders/`**. The **To pick** queue lists confirmed orders, oldest first.
2. Open an order. Lines show the **location** and, for serialised products, the **serials** held for it. Take those units, then press **Mark as picked**.
3. Pack the order and book the courier. Enter the **courier**, the **tracking number** and, optionally, the courier's https tracking link. Press **Mark as shipped**. The customer gets the "on its way" email with the tracking number.
4. When the courier confirms delivery, press **Mark as delivered**. The customer gets the delivery email.

Each step moves stock in the ledger: `reserved → picked → shipped → delivered`. Nobody edits a quantity. Pressing a button twice does nothing the second time.

## Cancelling

- Allowed until the order ships (statuses To pick and To ship). Open **Cancel order**, give a reason, and confirm.
- Stock goes back to `available` (picked units return to their shelf location in the ledger), and the full amount is refunded through the payment provider. The customer gets the cancellation email.
- After shipment, cancellation is refused: handle it as a return (RMA, later task).

## Refunds

| Refund status | Meaning                                         | Do                                                                                            |
| ------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `refunded`    | The provider refunded it; the reference is kept | Nothing                                                                                       |
| `manual`      | The provider cannot refund through its API      | Refund the amount in the gateway by hand, then add the reference to the order's notes         |
| `failed`      | The provider returned an error                  | Press **Retry refund** on the order. The same idempotency key is used, so it never pays twice |

Paid orders that failed as `stock-lost` (see the checkout runbook) show **Retry refund** too.

## Customer emails

- Every email is a row in **Sales → Notifications**: status `queued`, `sent` or `failed`, with attempts and the last error. The `sendNotification` job sends queued rows every minute and retries with backoff.
- A `failed` row has used its five attempts. Check `SMTP_URL` and the mail provider, then re-queue the job from **System → Payload jobs**. The outbox key stops a second copy being created.
- Without `SMTP_URL`, emails are written to the application log (local and CI).
- Every email links to `/{m}/{l}/orders/{number}/?token=…`. The token is derived from the order, so the link always works and can't be guessed.

## When a step fails

| Message on the order                            | Why                                                                  | Do                                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| "That step is not possible…"                    | The order is not at that step (someone else moved it), or it shipped | Reload the order and do the step its status shows                                             |
| "A line has lost its stock hold…"               | A reservation was released outside fulfilment                        | Open the Ledger explorer for the order's reservations; escalate. Do not adjust stock by hand. |
| Status stuck at Picking, Shipping, Delivering   | The server stopped mid-step                                          | Press the same button again: the step resumes and skips units already moved                   |
| "Enter the courier and a valid tracking number" | Tracking number empty or with symbols, or a non-https link           | Correct the form                                                                              |
