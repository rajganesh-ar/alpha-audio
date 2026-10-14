export type StockPromiseStatus = 'in-stock' | 'low' | 'on-order' | 'out'

export interface StockPromise {
  status: StockPromiseStatus
  /** Sellable units in the market (never shown as an exact number to consumers). */
  units: number
  /** Earliest expected arrival from an open purchase order, when out of stock. */
  eta: Date | null
}

/** At or below this many sellable units, the storefront says "only a few left". */
export const LOW_STOCK_UNITS = 2

/**
 * The consumer stock line, from `LedgerService.sellable` and `ReceivingService.openPurchaseEta`.
 * An ETA in the past is a late purchase order: the product is still "available to order", but
 * no date is promised.
 */
export function stockPromise(input: {
  sellable: number
  eta?: Date | null | undefined
  now?: Date | undefined
  lowUnits?: number | undefined
}): StockPromise {
  const units = Math.max(0, Math.trunc(input.sellable))
  const low = input.lowUnits ?? LOW_STOCK_UNITS
  if (units > low) return { status: 'in-stock', units, eta: null }
  if (units > 0) return { status: 'low', units, eta: null }
  if (input.eta) {
    const future = input.eta.getTime() > (input.now ?? new Date()).getTime()
    return { status: 'on-order', units: 0, eta: future ? input.eta : null }
  }
  return { status: 'out', units: 0, eta: null }
}

const SCHEMA_AVAILABILITY: Record<StockPromiseStatus, string> = {
  'in-stock': 'https://schema.org/InStock',
  low: 'https://schema.org/LimitedAvailability',
  'on-order': 'https://schema.org/BackOrder',
  out: 'https://schema.org/OutOfStock',
}

/** schema.org `Offer.availability` for a stock promise. */
export function schemaAvailability(status: StockPromiseStatus): string {
  return SCHEMA_AVAILABILITY[status]
}
