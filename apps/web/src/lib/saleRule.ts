import { publishedIn } from '@alpha/core'
import { brandsSellableIn, type RightsWindow } from '@alpha/payload'
import type { Product } from '@/payload-types'

/**
 * Storefront visibility (docs/tasks/0008, ADR 0008): a product is on sale in a market when it
 * is published there and its brand holds a live agreement there. Pure, so it is unit tested;
 * `rights.ts` feeds it the cached rights windows.
 */
export type SaleRule = (product: Product, market: string) => boolean

const brandIdOf = (product: Product) =>
  String(typeof product.brand === 'object' ? product.brand.id : product.brand)

export function saleRule(windows: readonly RightsWindow[], now: Date = new Date()): SaleRule {
  const byMarket = new Map<string, Set<string>>()
  return (product, market) => {
    if (!publishedIn(product.markets, market)) return false
    let brands = byMarket.get(market)
    if (!brands) byMarket.set(market, (brands = brandsSellableIn(windows, market, now)))
    return brands.has(brandIdOf(product))
  }
}
