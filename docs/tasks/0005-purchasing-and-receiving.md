# Task 0005 — Suppliers, purchase orders and goods receipt

Phase: P1 Operations core. Depends on: 0004. Spec: sections 5 (Inventory collections), 7 (Server logic → Stock ledger) and 4 (Warehouse PWA, for the flows this serves).

## Goal

Stock enters the ledger only through a posted goods receipt against a purchase order, with exceptions recorded, serials captured and duplicates blocked. The receiving PWA (a later task) is a screen on top of this service.

## Deliverables

- Collections in `packages/payload/collections/purchasing/`:
  - `Suppliers`: code, name, country, currency, lead time (days), contact, active.
  - `PurchaseOrders`: number (unique), supplier, destination warehouse, currency, expectedAt, status (`draft` | `ordered` | `partially_received` | `received` | `closed` | `cancelled`), lines (sku, description, qty ordered, unit cost in minor units, serialised). Received quantities are derived from posted receipts.
  - `GoodsReceipts`: number (unique), purchase order, receiving location, status (`draft` | `posted`), lines (PO line, sku, qty received, serials, exceptions: `short` | `over` | `damaged` | `wrong_item` | `missing_serial`, with a note), postedAt, postedBy.
- `packages/core/purchasing/ReceivingService`:
  - `postReceipt()` validates against the PO, then posts ledger movements (`null → received`, `docType = receipt`, `docId` = receipt number). Damaged units go on to `quarantine`.
  - It updates PO status. Posting is once only, and concurrent posts of the same receipt cannot both succeed.
  - `putaway()` moves received units to `available` at a target location.
  - `openPurchaseEta(sku, market)` returns the earliest expected date with an outstanding quantity.
- Rules:
  - Over-receipt beyond the line needs an `over` exception.
  - Every unit of a serialised line needs a serial, with no duplicates within the receipt or against the ledger.
  - A cancelled or closed PO cannot be received.
- Route handlers `POST /api/v1/ops/receipts/{id}/post` and `/putaway` (staff session, Zod-validated) calling the service.
- Field-level read restriction on PO `unitCost` (named access function), tested.
- Migration, regenerated types, a demo seed (a supplier, one open PO, one posted receipt), ADR if the receipt model changes the ledger contract.

## Acceptance criteria

- [x] A posted receipt writes exactly one `receipt` movement per bulk line (or one per serial), and the ledger invariants still hold.
- [x] Posting the same receipt twice, or twice in parallel, posts it once; the second attempt is refused.
- [x] A serialised line with a missing or duplicate serial cannot be posted; the error names the serial.
- [x] Partial receipts move the PO to `partially_received`, the last one to `received`; the PO's outstanding quantity per line is correct after each.
- [x] Damaged units end in `quarantine`, not `available`, and the receipt records the exception.
- [x] `openPurchaseEta` returns the earliest open expected date for a SKU in a market, or none.
- [x] Anonymous and non-staff requests cannot read `unitCost`; the route handlers refuse requests without a staff session.
