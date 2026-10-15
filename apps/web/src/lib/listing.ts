import { z } from 'zod'
import {
  EMPTY_LISTING_QUERY,
  LISTING_SORTS,
  formatMoney,
  money,
  type ListingFacets,
  type ListingItem,
  type ListingQuery,
  type PriceRange,
  type StockPromise,
} from '@alpha/core'
import { FACET_SPECS, type FacetSpec, type MarketRoute } from '@alpha/payload'
import type { FacetGroup, Translate } from '@alpha/ui'
import type { Category, Product } from '@/payload-types'
import { brandOf, numberLocale, priceOf } from './productView'

/** Listing URLs (docs/tasks/0007): parse the query, build links, map products and facets. */

export type ListingMarket = MarketRoute['market']

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const major = z.string().regex(/^\d{0,12}$/)

/** `price=10000-25000`, `-10000` or `25000-`, in major units of the market currency. */
export function parsePrice(value: string | null, decimals: number): PriceRange | null {
  if (!value) return null
  const [lo = '', hi = '', ...rest] = value.split('-')
  if (
    rest.length ||
    !major.safeParse(lo).success ||
    !major.safeParse(hi).success ||
    (lo === '' && hi === '')
  )
    return null
  const unit = 10n ** BigInt(decimals)
  const range = {
    min: lo === '' ? null : BigInt(lo) * unit,
    max: hi === '' ? null : BigInt(hi) * unit,
  }
  return range.min !== null && range.max !== null && range.min >= range.max ? null : range
}

export function formatPrice(range: PriceRange, decimals: number): string {
  const unit = 10n ** BigInt(decimals)
  return `${range.min === null ? '' : range.min / unit}-${range.max === null ? '' : range.max / unit}`
}

/** Unknown or malformed values are ignored, never an error: the page still renders. */
export function parseListingQuery(params: URLSearchParams, market: ListingMarket): ListingQuery {
  const brands = params.getAll('brand').filter((b) => slug.safeParse(b).success)
  const specs: Record<string, number[]> = {}
  for (const key of FACET_SPECS) {
    const values = params
      .getAll(`spec.${key}`)
      .map(Number)
      .filter((n) => Number.isFinite(n))
    if (values.length) specs[key] = [...new Set(values)]
  }
  const sort = z.enum(LISTING_SORTS).safeParse(params.get('sort'))
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .safeParse(params.get('page') ?? '1')
  return {
    brands: [...new Set(brands)],
    price: parsePrice(params.get('price'), market.decimals),
    inStock: params.get('stock') === 'in',
    specs,
    sort: sort.success ? sort.data : 'featured',
    page: page.success ? page.data : 1,
  }
}

/** Whether anything narrows or reorders the results (pagination alone does not). */
export const isFiltered = (q: ListingQuery): boolean =>
  q.brands.length > 0 ||
  q.price !== null ||
  q.inStock ||
  Object.values(q.specs).some((v) => v.length > 0) ||
  q.sort !== 'featured'

export function listingSearch(q: ListingQuery, market: ListingMarket): string {
  const params = new URLSearchParams()
  for (const b of q.brands) params.append('brand', b)
  if (q.price) params.set('price', formatPrice(q.price, market.decimals))
  if (q.inStock) params.set('stock', 'in')
  for (const [key, values] of Object.entries(q.specs))
    for (const v of values) params.append(`spec.${key}`, String(v))
  if (q.sort !== EMPTY_LISTING_QUERY.sort) params.set('sort', q.sort)
  if (q.page > 1) params.set('page', String(q.page))
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const listingHref = (base: string, q: ListingQuery, market: ListingMarket): string =>
  `${base}${listingSearch(q, market)}`

export function toListingItems(
  products: readonly Product[],
  route: MarketRoute,
  stock: ReadonlyMap<string, StockPromise>,
): Array<ListingItem<Product>> {
  return products.map((product, position) => {
    const brand = brandOf(product)
    const specs = product.specs ?? {}
    return {
      id: product.id,
      title: product.title,
      brand: brand ? { slug: brand.slug, name: brand.name } : null,
      price: priceOf(product, route),
      specs: Object.fromEntries(FACET_SPECS.map((key) => [key, specs[key] ?? null])),
      stock: stock.get(product.sku)?.status ?? 'out',
      createdAt: product.createdAt,
      position,
      data: product,
    }
  })
}

/** The facet specs a category offers: its own, else its nearest ancestor's. */
export function facetSpecsFor(trail: readonly Category[]): FacetSpec[] {
  for (const category of [...trail].reverse())
    if (category.facetSpecs?.length) return category.facetSpecs
  return []
}

const SPEC_LABEL: Record<FacetSpec, Parameters<Translate>[0]> = {
  channels: 'product.spec.channels',
  impedanceOhm: 'product.spec.impedance',
  minImpedanceOhm: 'product.spec.minImpedance',
  sensitivityDb: 'product.spec.sensitivity',
  powerW: 'product.spec.power',
}

function specValue(key: FacetSpec, value: number, t: Translate, n: Intl.NumberFormat): string {
  const v = n.format(value)
  switch (key) {
    case 'impedanceOhm':
    case 'minImpedanceOhm':
      return t('product.spec.ohmValue', { value: v })
    case 'sensitivityDb':
      return t('product.spec.dbValue', { value: v })
    case 'powerW':
      return t('product.spec.wattValue', { value: v })
    case 'channels':
      return v
  }
}

export function facetGroups(
  facets: ListingFacets,
  q: ListingQuery,
  route: MarketRoute,
  t: Translate,
): FacetGroup[] {
  const { market } = route
  const n = new Intl.NumberFormat(numberLocale(route))
  const amount = (minor: bigint) =>
    formatMoney(money(minor, market.currency, market.decimals), route.languageTag, {
      wholeUnits: true,
    })
  const groups: FacetGroup[] = []
  if (facets.brands.length > 1 || q.brands.length) {
    groups.push({
      id: 'brand',
      legend: t('listing.brand'),
      name: 'brand',
      type: 'checkbox',
      options: facets.brands.map((b) => ({
        value: b.value,
        label: b.name,
        count: b.count,
        checked: b.selected,
      })),
    })
  }
  if (facets.priceBands.length) {
    groups.push({
      id: 'price',
      legend: t('listing.price'),
      name: 'price',
      type: 'radio',
      options: [
        { value: '', label: t('listing.anyPrice'), checked: q.price === null },
        ...facets.priceBands.map(({ value: range, count, selected }) => ({
          value: formatPrice(range, market.decimals),
          label:
            range.min === null
              ? t('listing.priceUnder', { max: amount(range.max ?? 0n) })
              : range.max === null
                ? t('listing.priceFrom', { min: amount(range.min) })
                : t('listing.priceBand', { min: amount(range.min), max: amount(range.max) }),
          count,
          checked: selected,
        })),
      ],
    })
  }
  groups.push({
    id: 'stock',
    legend: t('listing.availability'),
    name: 'stock',
    type: 'checkbox',
    options: [
      {
        value: 'in',
        label: t('listing.inStockOnly'),
        count: facets.inStock.count,
        checked: facets.inStock.selected,
      },
    ],
  })
  for (const facet of facets.specs) {
    const key = facet.key as FacetSpec
    groups.push({
      id: `spec-${key}`,
      legend: t(SPEC_LABEL[key]),
      name: `spec.${key}`,
      type: 'checkbox',
      options: facet.values.map((v) => ({
        value: String(v.value),
        label: specValue(key, v.value, t, n),
        count: v.count,
        checked: v.selected,
      })),
    })
  }
  return groups
}

/** How many filters are active, for the "Filters (n)" toggle. */
export const activeFilters = (q: ListingQuery): number =>
  q.brands.length +
  (q.price ? 1 : 0) +
  (q.inStock ? 1 : 0) +
  Object.values(q.specs).reduce((n, v) => n + v.length, 0)
