import type { LedgerTx } from '../ledger/store'
import type { Id } from '../ledger/types'
import type { PoStatus, PurchaseOrderRecord, ReceiptRecord } from './types'

/** One transaction holding both the purchasing rows and the ledger. */
export interface PurchasingTx {
  ledger: LedgerTx
  /** Locks the receipt row; `null` if it does not exist. */
  lockReceipt(id: Id): Promise<ReceiptRecord | null>
  lockPurchaseOrder(id: Id): Promise<PurchaseOrderRecord | null>
  /** The warehouse a location belongs to, or null for no such location. */
  locationWarehouse(id: Id): Promise<Id | null>
  markReceiptPosted(id: Id, at: Date, user: Id | null): Promise<void>
  markReceiptPutAway(id: Id, at: Date, user: Id | null, location: Id): Promise<void>
  /** Writes each line's received quantity and the PO status. */
  updatePurchaseOrder(
    id: Id,
    received: ReadonlyMap<string, number>,
    status: PoStatus,
  ): Promise<void>
}

export interface PurchasingStore {
  transaction<T>(work: (tx: PurchasingTx) => Promise<T>): Promise<T>
  /** Earliest `expectedAt` among open POs into the market with an outstanding quantity of the SKU. */
  openPurchaseEta(sku: string, market: string): Promise<Date | null>
}
