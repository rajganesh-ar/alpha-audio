export type LedgerErrorCode =
  | 'invalid-quantity'
  | 'invalid-move'
  | 'insufficient-stock'
  | 'serial-required'
  | 'serial-not-allowed'
  | 'serial-state'
  | 'serial-duplicate'
  | 'reason-required'
  | 'reservation-not-found'
  | 'reservation-not-active'
  | 'reservation-expired'
  | 'expiry-required'

/** A ledger rule refused the operation. Nothing was written: the transaction rolled back. */
export class LedgerError extends Error {
  constructor(
    readonly code: LedgerErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'LedgerError'
  }
}
