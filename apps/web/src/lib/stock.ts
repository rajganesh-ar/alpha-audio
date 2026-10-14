import { getPayload } from 'payload'
import config from '@payload-config'
import { stockPromise, type StockPromise } from '@alpha/core'
import { createLedger, createReceiving } from '@alpha/payload'

/**
 * The consumer stock promise for SKUs in a market, straight from the ledger (never cached:
 * spec, "stock promises never"). Used by the stock API the live stock line calls, and by the
 * product page render for the server-rendered line and the JSON-LD availability.
 */
export async function stockPromises(
  skus: readonly string[],
  market: string,
  now = new Date(),
): Promise<Map<string, StockPromise>> {
  const payload = await getPayload({ config })
  const ledger = createLedger(payload)
  const receiving = createReceiving(payload)
  const unique = [...new Set(skus)]
  const entries = await Promise.all(
    unique.map(async (sku) => {
      const sellable = await ledger.sellable(sku, market)
      const eta = sellable > 0 ? null : await receiving.openPurchaseEta(sku, market)
      return [sku, stockPromise({ sellable, eta, now })] as const
    }),
  )
  return new Map(entries)
}
