export type ReceivingErrorCode =
  | 'receipt-not-found'
  | 'receipt-already-posted'
  | 'receipt-not-posted'
  | 'receipt-already-put-away'
  | 'receipt-empty'
  | 'po-not-open'
  | 'wrong-warehouse'
  | 'unknown-location'
  | 'unknown-po-line'
  | 'sku-mismatch'
  | 'over-receipt'
  | 'serial-missing'
  | 'serial-duplicate'
  | 'serial-not-allowed'
  | 'invalid-exception'
  | 'invalid-quantity'
  | 'invalid-status-change'

/** A receiving rule refused the operation; nothing was written. */
export class ReceivingError extends Error {
  constructor(
    readonly code: ReceivingErrorCode,
    message: string,
    /** The offending line or serial, so a screen can point at it. */
    readonly detail?: { line?: number; serial?: string; poLine?: string },
  ) {
    super(message)
    this.name = 'ReceivingError'
  }
}
