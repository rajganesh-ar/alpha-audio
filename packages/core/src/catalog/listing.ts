import type { ConsumerPrice } from './consumerPrice'
import type { StockPromiseStatus } from './stockPromise'

/**
 * Category listing (docs/tasks/0007): filters, disjunctive facet counts, price bands, sort and
 * pagination over the products of one category in one market. Pure: the storefront passes in
 * items whose price (consumerPrice) and stock (stockPromise) are already resolved.
 */

export const LISTING_SORTS = ['featured', 'price-asc', 'price-desc', 'newest', 'name'] as const
export type ListingSort = (typeof LISTING_SORTS)[number]

export const LISTING_PAGE_SIZE = 24

export interface ListingItem<T = unknown> {
  id: string | number
  title: string
  brand: { slug: string; name: string } | null
  /** `unavailable` items (not sold in the market) are dropped before anything else. */
  price: ConsumerPrice
  specs: Readonly<Record<string, number | null | undefined>>
  stock: StockPromiseStatus
  /** ISO 8601, for "newest". */
  createdAt: string
  /** Merchandising order, for "featured" and as the tie-breaker. */
  position: number
  /** Whatever the caller needs to render the card; passed through untouched. */
  data: T
}

/** Half-open `[min, max)` in minor units; `null` is unbounded. */
export interface PriceRange {
  min: bigint | null
  max: bigint | null
}

export interface ListingQuery {
  brands: readonly string[]
  price: PriceRange | null
  inStock: boolean
  specs: Readonly<Record<string, readonly number[]>>
  sort: ListingSort
  /** 1-based. */
  page: number
}

export const EMPTY_LISTING_QUERY: ListingQuery = {
  brands: [],
  price: null,
  inStock: false,
  specs: {},
  sort: 'featured',
  page: 1,
}

export interface FacetValue<V> {
  value: V
  count: number
  selected: boolean
}

export interface ListingFacets {
  brands: Array<FacetValue<string> & { name: string }>
  priceBands: Array<FacetValue<PriceRange>>
  inStock: { count: number; selected: boolean }
  specs: Array<{ key: string; values: Array<FacetValue<number>> }>
}

export interface ListingResult<T> {
  items: Array<ListingItem<T>>
  total: number
  page: number
  pages: number
  /** The requested page is past the last one (the page should 404). */
  outOfRange: boolean
  facets: ListingFacets
}

const IN_STOCK: ReadonlySet<StockPromiseStatus> = new Set(['in-stock', 'low'])
const amountOf = (item: ListingItem): bigint | null =>
  item.price.kind === 'priced' ? item.price.price.amount : null

export const sameRange = (a: PriceRange | null, b: PriceRange | null): boolean =>
  a !== null && b !== null && a.min === b.min && a.max === b.max

export function inRange(amount: bigint, range: PriceRange): boolean {
  return (range.min === null || amount >= range.min) && (range.max === null || amount < range.max)
}

type Filter = 'brands' | 'price' | 'inStock' | `spec:${string}`

function passes(item: ListingItem, query: ListingQuery, except?: Filter): boolean {
  if (
    except !== 'brands' &&
    query.brands.length &&
    !(item.brand && query.brands.includes(item.brand.slug))
  )
    return false
  if (except !== 'price' && query.price) {
    const amount = amountOf(item)
    if (amount === null || !inRange(amount, query.price)) return false
  }
  if (except !== 'inStock' && query.inStock && !IN_STOCK.has(item.stock)) return false
  for (const [key, values] of Object.entries(query.specs)) {
    if (except === `spec:${key}` || values.length === 0) continue
    const value = item.specs[key]
    if (typeof value !== 'number' || !values.includes(value)) return false
  }
  return true
}

/** A readable edge: the nearest of 1, 2, 2.5 and 5 times a power of ten. */
export function niceNumber(value: number): number {
  if (!(value > 0)) return 0
  const power = 10 ** Math.floor(Math.log10(value))
  const steps = [1, 2, 2.5, 5, 10]
  const fraction = value / power
  const best = steps.reduce((a, b) => (Math.abs(b - fraction) < Math.abs(a - fraction) ? b : a))
  return best * power
}

/**
 * Up to four price bands from the quartiles of the prices, with edges rounded to readable
 * whole amounts in the currency's major unit. No bands when fewer than two distinct prices.
 */
export function priceBands(amounts: readonly bigint[], decimals: number): PriceRange[] {
  const sorted = [...new Set(amounts)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  if (sorted.length < 2) return []
  const unit = 10 ** decimals
  const lowest = Number(sorted[0]) / unit
  const highest = Number(sorted[sorted.length - 1]) / unit
  const quantile = (q: number) =>
    Number(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]) / unit
  const edges = [...new Set([0.25, 0.5, 0.75].map((q) => niceNumber(quantile(q))))]
    .filter((edge) => edge > lowest && edge <= highest)
    .sort((a, b) => a - b)
  if (edges.length === 0) return []
  const minor = (major: number) => BigInt(Math.round(major)) * BigInt(unit)
  const bounds = edges.map(minor)
  return [null, ...bounds].map((min, i) => ({ min, max: bounds[i] ?? null }))
}

function compareBy(sort: ListingSort, locale: string): (a: ListingItem, b: ListingItem) => number {
  const byPosition = (a: ListingItem, b: ListingItem) => a.position - b.position
  switch (sort) {
    case 'featured':
      return byPosition
    case 'newest':
      return (a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : byPosition(a, b)
    case 'name': {
      const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
      return (a, b) => collator.compare(a.title, b.title) || byPosition(a, b)
    }
    case 'price-asc':
    case 'price-desc': {
      const direction = sort === 'price-asc' ? 1 : -1
      return (a, b) => {
        const x = amountOf(a)
        const y = amountOf(b)
        // Price on request sorts last in both directions.
        if (x === null || y === null) return x === y ? byPosition(a, b) : x === null ? 1 : -1
        return x === y ? byPosition(a, b) : (x < y ? -1 : 1) * direction
      }
    }
  }
}

export function buildListing<T>(
  all: ReadonlyArray<ListingItem<T>>,
  query: ListingQuery,
  options: { locale: string; specFacets?: readonly string[]; pageSize?: number } = { locale: 'en' },
): ListingResult<T> {
  const base = all.filter((item) => item.price.kind !== 'unavailable')
  const size = options.pageSize ?? LISTING_PAGE_SIZE
  const matching = base.filter((item) => passes(item, query))
  const sorted = [...matching].sort(compareBy(query.sort, options.locale))
  const pages = Math.max(1, Math.ceil(sorted.length / size))
  const page = Math.max(1, Math.trunc(query.page))

  const brandNames = new Map<string, string>()
  for (const item of base) if (item.brand) brandNames.set(item.brand.slug, item.brand.name)
  const forBrands = base.filter((item) => passes(item, query, 'brands'))
  const brands = [...brandNames]
    .map(([slug, name]) => ({
      value: slug,
      name,
      count: forBrands.filter((item) => item.brand?.slug === slug).length,
      selected: query.brands.includes(slug),
    }))
    .filter((b) => b.count > 0 || b.selected)
    .sort((a, b) =>
      new Intl.Collator(options.locale, { sensitivity: 'base' }).compare(a.name, b.name),
    )

  const decimals = base.find((item) => item.price.kind === 'priced')
  const bands =
    decimals && decimals.price.kind === 'priced'
      ? priceBands(
          base.map(amountOf).filter((a): a is bigint => a !== null),
          decimals.price.price.decimals,
        )
      : []
  const forPrice = base.filter((item) => passes(item, query, 'price'))
  const priceFacet = bands.map((range) => ({
    value: range,
    count: forPrice.filter((item) => {
      const amount = amountOf(item)
      return amount !== null && inRange(amount, range)
    }).length,
    selected: sameRange(range, query.price),
  }))

  const forStock = base.filter((item) => passes(item, query, 'inStock'))
  const specs = (options.specFacets ?? [])
    .map((key) => {
      const forSpec = base.filter((item) => passes(item, query, `spec:${key}`))
      const present = [
        ...new Set(
          base.map((item) => item.specs[key]).filter((v): v is number => typeof v === 'number'),
        ),
      ].sort((a, b) => a - b)
      const selected = query.specs[key] ?? []
      return {
        key,
        values: present
          .map((value) => ({
            value,
            count: forSpec.filter((item) => item.specs[key] === value).length,
            selected: selected.includes(value),
          }))
          .filter((v) => v.count > 0 || v.selected),
      }
    })
    .filter((facet) => facet.values.length > 1 || facet.values.some((v) => v.selected))

  return {
    items: sorted.slice((page - 1) * size, page * size),
    total: sorted.length,
    page,
    pages,
    outOfRange: page > pages,
    facets: {
      brands,
      priceBands: priceFacet,
      inStock: {
        count: forStock.filter((item) => IN_STOCK.has(item.stock)).length,
        selected: query.inStock,
      },
      specs,
    },
  }
}
