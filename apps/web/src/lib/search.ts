import type { Payload } from 'payload'
import { pageOf, parseSearchQuery, type SearchQuery } from '@alpha/core'
import { searchProductIds, type MarketRoute } from '@alpha/payload'
import type { Product } from '@/payload-types'
import type { SaleRule } from './saleRule'

export interface SearchResult {
  query: SearchQuery
  products: Product[]
  total: number
  page: number
  pages: number
}

/**
 * Catalogue search for a market (docs/tasks/0011): ranked ids from the search index, then the
 * products as an anonymous visitor may read them, then the sale rule (published in the market
 * and live brand rights), in rank order, paged.
 */
export async function searchCatalogue(
  payload: Payload,
  route: MarketRoute,
  raw: unknown,
  page: number,
  onSale: SaleRule,
): Promise<SearchResult> {
  const query = parseSearchQuery(raw)
  const ids = await searchProductIds(payload, query, route.locale)
  if (ids.length === 0) return { query, products: [], total: 0, page: 1, pages: 1 }
  const { docs } = await payload.find({
    collection: 'products',
    where: { id: { in: ids } },
    limit: ids.length,
    depth: 1,
    locale: route.locale,
    fallbackLocale: 'en',
    overrideAccess: false,
    draft: false,
  })
  const byId = new Map(docs.map((p) => [p.id, p]))
  const ranked = ids
    .map((id) => byId.get(id))
    .filter((p): p is Product => p !== undefined && onSale(p, route.market.code))
  const window = pageOf(ranked, page)
  return {
    query,
    products: window.items,
    total: window.total,
    page: window.page,
    pages: window.pages,
  }
}
