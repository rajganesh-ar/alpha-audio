import { notFound } from 'next/navigation'
import { buildListing, type ListingQuery } from '@alpha/core'
import type { MarketRoute } from '@alpha/payload'
import {
  categoryTrail,
  descendantIds,
  getCategories,
  getListingProducts,
  parentId,
} from '@/lib/catalog'
import { facetSpecsFor, toListingItems } from '@/lib/listing'
import { localizedPath } from '@/lib/seo'
import { getSaleRule } from '@/lib/rights'
import { stockPromises } from '@/lib/stock'
import type { Category } from '@/payload-types'

/**
 * Resolves `/shop/{category?}/{subcategory?}` and computes its listing. Shared by the ISR page
 * and its dynamic twin. A wrong pair, an unknown category, a third segment or a page past the
 * last one is a 404.
 */
export async function loadListing(
  route: MarketRoute,
  path: readonly string[],
  query: ListingQuery,
) {
  if (path.length > 2) notFound()
  const categories = await getCategories(route.locale)
  const [first, second] = path
  let category: Category | null = null
  if (first) {
    const top = categories.find((c) => c.slug === first)
    if (!top) notFound()
    category = top
    if (second) {
      const child = categories.find((c) => c.slug === second)
      if (!child || parentId(child) !== top.id) notFound()
      category = child
    }
  }
  const trail = category ? categoryTrail(categories, category.id) : []
  const onSale = await getSaleRule()
  const products = (
    await getListingProducts(category ? descendantIds(categories, category.id) : null, route.locale)
  ).filter((p) => onSale(p, route.market.code))
  const stock = products.length
    ? await stockPromises(
        products.map((p) => p.sku),
        route.market.code,
      )
    : new Map()
  const result = buildListing(toListingItems(products, route, stock), query, {
    locale: route.languageTag,
    specFacets: facetSpecsFor(trail),
  })
  if (result.outOfRange) notFound()

  const pathFor = (segments: readonly string[]) =>
    localizedPath(route.market.code, route.locale, ['shop', ...segments].join('/'))
  const children = categories.filter((c) =>
    category ? parentId(c) === category.id : parentId(c) === null,
  )
  const suggestions = categories
    .filter((c) => parentId(c) === null && c.id !== trail[0]?.id)
    .slice(0, 6)
  return {
    category,
    trail,
    result,
    stock,
    base: pathFor(path),
    children: children.map((c) => ({
      category: c,
      href: pathFor(category ? [...trail.map((t) => t.slug), c.slug].slice(-2) : [c.slug]),
    })),
    suggestions: suggestions.map((c) => ({ category: c, href: pathFor([c.slug]) })),
    pathFor,
  }
}
