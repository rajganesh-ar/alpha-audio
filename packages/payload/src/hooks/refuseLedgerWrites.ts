import { APIError, type CollectionBeforeChangeHook, type CollectionBeforeDeleteHook } from 'payload'

/**
 * Ledger-written collections (StockMovements, StockLevels, SerialNumbers, Reservations) are
 * changed only by the ledger service, which writes in its own transaction. Access already
 * refuses every write; these hooks refuse them even with `overrideAccess: true`, so no admin
 * action, REST call or Local API script can make levels disagree with movements.
 */
export const refuseLedgerWrites: CollectionBeforeChangeHook = ({ collection, operation }) => {
  throw new APIError(
    `${collection.slug} is written only by the stock ledger (${operation} refused). Use LedgerService.`,
    403,
  )
}

export const refuseLedgerDeletes: CollectionBeforeDeleteHook = ({ collection }) => {
  throw new APIError(`${collection.slug} rows are never deleted.`, 403)
}
