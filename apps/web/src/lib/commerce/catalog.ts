import type { Payload } from 'payload'
import type { CatalogEntry } from '@alpha/core'
import { loadRightsWindows, type MarketRoute } from '@alpha/payload'
import type { Product } from '@/payload-types'
import { priceOf } from '@/lib/productView'
import { saleRule } from '@/lib/saleRule'

export interface CatalogHit {
  product: Product
  entry: CatalogEntry
}

/**
 * The catalogue's current word on SKUs in a market, for the bag and checkout. Uncached: a bag
 * shows today's price and rights on every view (docs/tasks/0009), and an anonymous Local API
 * read (`overrideAccess: false`) returns only published products without cost fields.
 */
export async function lookupCatalog(
  payload: Payload,
  skus: readonly string[],
  route: MarketRoute,
  now: Date = new Date(),
): Promise<Map<string, CatalogHit>> {
  const unique = [...new Set(skus)]
  if (unique.length === 0) return new Map()
  const [{ docs }, windows] = await Promise.all([
    payload.find({
      collection: 'products',
      where: { sku: { in: unique } },
      limit: unique.length,
      depth: 1,
      locale: route.locale,
      fallbackLocale: 'en',
      overrideAccess: false,
      draft: false,
    }),
    loadRightsWindows(payload),
  ])
  const onSale = saleRule(windows, now)
  return new Map(
    docs.map((product) => [
      product.sku,
      {
        product,
        entry: {
          sku: product.sku,
          productId: product.id,
          title: product.title,
          price: priceOf(product, route),
          onSale: onSale(product, route.market.code),
        },
      },
    ]),
  )
}
