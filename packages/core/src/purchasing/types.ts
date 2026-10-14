import type { Id } from '../ledger/types'

export const PO_STATUSES = [
  'draft',
  'ordered',
  'partially_received',
  'received',
  'closed',
  'cancelled',
] as const
export type PoStatus = (typeof PO_STATUSES)[number]

/** Statuses only receiving sets; staff never pick them by hand. */
export const SYSTEM_PO_STATUSES: readonly PoStatus[] = ['partially_received', 'received']

export const RECEIPT_STATUSES = ['draft', 'posted'] as const
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number]

export const RECEIPT_EXCEPTIONS = [
  'short',
  'over',
  'damaged',
  'wrong_item',
  'missing_serial',
] as const
export type ReceiptExceptionType = (typeof RECEIPT_EXCEPTIONS)[number]

export interface PoLine {
  id: string
  sku: string
  qtyOrdered: number
  /** Units booked into the ledger by posted receipts. */
  qtyReceived: number
  serialised: boolean
}

export interface PurchaseOrderRecord {
  id: Id
  number: string
  /** Destination warehouse; receipts must land at one of its locations. */
  warehouse: Id
  status: PoStatus
  expectedAt: Date | null
  lines: PoLine[]
}

export interface ReceiptException {
  type: ReceiptExceptionType
  /** Units affected (bulk lines). */
  qty?: number | undefined
  /** Serials affected (serialised lines, e.g. damaged units). */
  serials?: readonly string[] | undefined
  note?: string | undefined
}

export interface ReceiptLine {
  /** The purchase order line this receipt line answers. */
  poLine: string
  /** What arrived. Differs from the PO line only with a `wrong_item` exception. */
  sku: string
  /** Units counted at the dock, including damaged and unlabelled ones. */
  qty: number
  /** One per unit for serialised lines; units without a label need `missing_serial`. */
  serials: readonly string[]
  exceptions: readonly ReceiptException[]
}

export interface ReceiptRecord {
  id: Id
  number: string
  purchaseOrder: Id
  /** Receiving location (the dock), in the PO's warehouse. */
  location: Id
  /** Warehouse of `location`. */
  locationWarehouse: Id
  status: ReceiptStatus
  putAway: boolean
  lines: ReceiptLine[]
}
