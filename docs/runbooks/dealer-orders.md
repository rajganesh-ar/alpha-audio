# Runbook — dealer orders

How dealer orders flow, who approves what, and what to do when one is stuck. Read ADR 0015 for the design and the dealer board runbook for access.

## The flow

1. The dealer builds the order on the board (`/orders/new`, or "Order" on a catalogue row). The review shows:
   - their prices, with "Why this price";
   - order rule problems;
   - the approvals the order will need;
   - their credit.
2. Placing it holds the stock for every line (all or none). The order is then:
   - **confirmed** at once: an owner or purchaser within their threshold, within credit, at normal prices;
   - **waiting for approval**: the stock is held for 72 hours, and the order shows who it waits for.
3. When every approval is given, the order is confirmed and the stock is held for good. A rejection or a cancel releases it.

## Who approves

| Approval            | Why                                                                                      | Who                                          |
| ------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| Company (threshold) | A purchaser's order is above their approval threshold (net)                              | An owner of the company, on the order's page |
| Alpha (credit)      | Credit used plus this order's gross exceeds the limit, or the company has no credit line | Staff, on `/ops/trade-orders/`               |
| Alpha (price)       | A line is below the margin floor                                                         | Staff, on `/ops/trade-orders/`               |

A note added when deciding is shown to the dealer on the order.

## Settings that shape orders

- **Companies → Credit limit** (minor units). Used credit counts every open order (waiting or confirmed) until statements record payments, so raise the limit or cancel stale orders if a dealer is wrongly blocked.
- **Companies → Hold**: blocks ordering (not browsing).
- **Companies → Settings → Order multiple / Minimum order value** (net).
- **Company users → Role and Approval threshold**: only owners and purchasers order; a purchaser without a threshold needs no company approval.

## When something is stuck

- **"Being approved" for more than a minute**: a decision crashed half-way. The order is in `approving`. Check its reservations in the Ledger explorer, then ask engineering to move it back to `pending-approval` (a one-row SQL update recorded in the incident).
- **Failed (stock no longer available)**: the hold lapsed and the stock was sold before the last approval. Tell the dealer, who can order again.
- **"Some products are no longer in stock"** on placing: another order took the stock between the review and the click. Nothing was ordered.
