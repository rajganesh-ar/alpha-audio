# Runbook — purchasing and goods receipt

Stock from suppliers enters the ledger only by posting a goods receipt against a purchase order. Read ADR 0005 for the design; this page is for operating it.

## The flow

1. **Purchase order** (Purchasing → Purchase orders): create it as `draft`, check the lines, set it to `ordered`. Lines are frozen from then on; to change what was ordered, cancel it and raise a new PO.
2. **Goods receipt** (Purchasing → Goods receipts, or the receiving PWA): one per delivery, at the warehouse's receiving dock. Add one line per PO line that arrived, with the quantity and, for serialised products, every serial.
3. **Post** (`POST /api/v1/ops/receipts/{id}/post`): books the units as `received` at the dock and updates the PO. A posted receipt can no longer change.
4. **Put away** (`POST /api/v1/ops/receipts/{id}/putaway` with `{ "location": <id> }`): moves the good units to `available` at a location in the same warehouse. Damaged and wrong items stay in quarantine.

## Recording exceptions

| What happened               | Record                                                           | Effect                                                                          |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Fewer units than ordered    | Receive what arrived; optionally a `short` exception with a note | PO stays `partially_received`; the rest is still expected (and feeds the ETA)   |
| More units than ordered     | `over` exception                                                 | Without it, posting is refused                                                  |
| Damaged units               | `damaged` with `qty` (bulk) or `serials` (serialised)            | Booked, then moved to `quarantine`; not put away                                |
| A different product arrived | Line SKU = what arrived, plus `wrong_item`                       | Booked under that SKU, all to `quarantine`; the PO line is not filled           |
| A unit has no serial label  | `missing_serial` with `qty`                                      | Counted but not booked; label it and book it with a new receipt line or a count |

## Refusals and what to do

| Code                     | Meaning                                                       | Fix                                                                      |
| ------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `receipt-already-posted` | Someone (or a retry) posted it already                        | Nothing; check the receipt and the Ledger explorer                       |
| `serial-missing`         | Units without serials on a serialised line                    | Scan them, or record `missing_serial`                                    |
| `serial-duplicate`       | A serial is on the receipt twice, or already in stock (named) | Rescan; if the serial is genuinely in stock elsewhere, investigate first |
| `over-receipt`           | More than ordered without an `over` exception                 | Add the exception, or receive only the ordered quantity                  |
| `po-not-open`            | PO is draft, received, closed or cancelled                    | Set it to `ordered`, or receive against the right PO                     |
| `wrong-warehouse`        | Dock or put-away location is in another warehouse             | Use a location of the PO's warehouse                                     |
| `sku-mismatch`           | Line SKU differs from the PO line                             | Fix the SKU, or record `wrong_item`                                      |

## A posted receipt is wrong

Posted receipts and their movements never change. Correct with a new document: an adjustment with a reason for a miscount, a transfer for the wrong shelf, an RMA to the supplier for wrong items. Closing a PO with units still outstanding (`ordered → closed` or `partially_received → closed`) stops them from feeding the ETA.

## Local demo data

```
pnpm --filter @alpha/web seed:inventory
pnpm --filter @alpha/web seed:purchasing
```

This creates supplier `MCINTOSH-US`, `PO-2026-0100` (partially received) and the posted, put-away receipt `GR-2026-0002`. It is for local development only.
