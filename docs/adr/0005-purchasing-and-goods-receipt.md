# ADR 0005 — Purchasing and goods receipt

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0005-purchasing-and-receiving.md`

## Context

Supplier stock must enter the ledger only through a posted goods receipt against a purchase order. Receipts carry exceptions (short, over, damaged, wrong item, missing serial label) and serials. Posting has to be once only, even when the receiving PWA retries on a flaky warehouse connection. The rest of the platform needs an ETA for stock that is on order.

## Decision

### 1. Three collections; the receipt is the ledger document

`Suppliers`, `PurchaseOrders` (lines with SKU, quantity, unit cost in minor units, serialised flag) and `GoodsReceipts` (lines against PO line ids, serials, exceptions) live in `packages/payload/src/collections/purchasing/`. Every ledger movement a receipt causes has `docId` = the receipt number. Entry movements (`null → received`) use `docType = receipt`. The put-away is a `transfer` with the same `docId`, or a `receipt` move when the units stay at the dock location.

- **Received quantity is a projection.** `qtyReceived` on a PO line is written only by posting, in the same transaction as the movements. It works like `StockLevels` for the ledger: field access refuses it to everyone, the database checks it, and the integration tests compare it with the posted receipts.
- **Status:** staff move a PO through `draft → ordered → closed`, or cancel it. Receiving sets `partially_received` and `received`. Lines are frozen once a PO leaves `draft`. Corrections are a new PO, not edits, because posted receipts reference line ids.
- **A posted receipt never changes.** A `beforeChange` hook refuses edits. A database trigger refuses any change to a posted receipt's lines and exceptions, and allows only one change to the receipt row: the put-away stamp, once. Deleting a receipt is refused for everyone.

### 2. `ReceivingService` in `packages/core`, sharing the ledger's transaction

`ReceivingService` (pure, with a `PurchasingStore` port) validates the receipt against the PO and plans each line. Damaged units go `received → quarantine`. Wrong items are booked under the SKU that arrived and quarantined, and do not fill the PO line. Units without a serial label are counted but not booked. Posting then writes the movements and updates the PO.

The ledger contract gains one method, `LedgerService.applyWithin(tx, operations)`. It applies moves and transfers inside a transaction the caller already holds, with the same validation and level locking as `move` and `transfer`. `PostgresPurchasingStore` passes its Drizzle transaction to the ledger through the exported `transactionApi(tx)`. A receipt therefore posts all its movements, the PO update and the posted stamp, or none of them. The ledger keeps sole ownership of stock tables; purchasing never writes them.

### 3. Once only, by row lock

Posting locks the receipt row (`SELECT … FOR UPDATE`) before anything else. It then locks the PO row and its lines, then the ledger's level rows in their usual order. A second post of the same receipt waits, then sees `posted` and is refused (`receipt-already-posted`, HTTP 409). Two receipts against one PO serialise on the PO row, so neither can lose the other's received quantity. No idempotency key is needed: the receipt id is the key.

### 4. Rules

- Over-receipt beyond a line, across all its receipts, needs an `over` exception.
- A serialised line needs one serial per unit, or a `missing_serial` exception for the units without a label. Serials must be unique within the receipt and new to the ledger. The error names the serial.
- Only `ordered` and `partially_received` POs can be received. The receiving location and the put-away location must be in the PO's warehouse.

### 5. Ops endpoints

`POST /api/v1/ops/receipts/{id}/post` and `/putaway` read the staff user from the Payload session (cookie or `Authorization: JWT`). They refuse cross-site `Origin` headers, validate bodies with strict Zod schemas (so a `companyId` or `user` in the body is a 400), and return `private, no-store`. Refusals map to 404, 409 or 422 with `{ error: { code, message, detail } }`. The handlers hold no business logic.

### 6. Cost

`unitCost` has field-level `read: canReadCost` (staff only until the roles task). The purchasing collections are staff-only at collection level as well. Field-level write access `systemWritten` marks values that only a system service writes (`qtyReceived`, receipt status and stamps).

## Consequences

- The receiving PWA (a later task) only needs to build a draft receipt and call the two endpoints.
- `openPurchaseEta(sku, market)` serves the stock promise. It returns the earliest `expectedAt` of an open PO, in a warehouse of that market, with an outstanding quantity on the SKU. A past date is still returned (a late PO); the caller decides how to word it.
- The admin's receipt line asks for the PO line id, which is fine for staff tooling but not for the dock. The PWA will pick lines from the PO.
- A `wrong_item` line books stock under a SKU the PO never ordered. Buyers resolve it with the supplier (return, or a new PO line) through an adjustment or an RMA. That is not automated yet.
