import { describe, expect, it } from 'vitest'
import { money } from '../money'
import type { ConsumerPrice } from './consumerPrice'
import {
  EMPTY_LISTING_QUERY,
  buildListing,
  niceNumber,
  priceBands,
  sameRange,
  type ListingItem,
  type ListingQuery,
} from './listing'

const priced = (major: number): ConsumerPrice => ({
  kind: 'priced',
  price: money(major * 100, 'AED', 2),
  vat: money(0, 'AED', 2),
  vatRate: 5,
})
const request: ConsumerPrice = { kind: 'request' }
const unavailable: ConsumerPrice = { kind: 'unavailable' }

let position = 0
const item = (
  title: string,
  brand: string,
  price: ConsumerPrice,
  extra: Partial<ListingItem<string>> = {},
): ListingItem<string> => ({
  id: title,
  title,
  brand: { slug: brand, name: brand[0]?.toUpperCase() + brand.slice(1) },
  price,
  specs: {},
  stock: 'in-stock',
  createdAt: `2026-01-${String(++position).padStart(2, '0')}T00:00:00Z`,
  position,
  data: title,
  ...extra,
})

const ITEMS = [
  item('MA352', 'mcintosh', priced(34_500), { specs: { channels: 2, impedanceOhm: 8 } }),
  item('MC462', 'mcintosh', priced(52_500), { specs: { channels: 2 }, stock: 'out' }),
  item('Lumina II', 'sonus', priced(7_900), { specs: { impedanceOhm: 4 }, stock: 'low' }),
  item('Olympica', 'sonus', request, { specs: { impedanceOhm: 4 }, stock: 'on-order' }),
  item('Cinema 50', 'marantz', priced(11_500), { specs: { channels: 9 } }),
  item('Node', 'bluesound', priced(2_399)),
  item('Hidden', 'bluesound', unavailable),
]
const q = (patch: Partial<ListingQuery> = {}): ListingQuery => ({
  ...EMPTY_LISTING_QUERY,
  ...patch,
})
const titles = (query: ListingQuery, locale = 'en') =>
  buildListing(ITEMS, query, { locale, specFacets: ['channels', 'impedanceOhm'] }).items.map(
    (i) => i.title,
  )

describe('buildListing filters', () => {
  it('never lists or counts products not sold in the market', () => {
    const result = buildListing(ITEMS, q(), { locale: 'en' })
    expect(result.total).toBe(6)
    expect(result.items.map((i) => i.title)).not.toContain('Hidden')
    expect(result.facets.brands.find((b) => b.value === 'bluesound')?.count).toBe(1)
  })

  it('filters by brand, price band, stock and spec value', () => {
    expect(titles(q({ brands: ['sonus'] }))).toEqual(['Lumina II', 'Olympica'])
    expect(titles(q({ brands: ['sonus', 'marantz'] }))).toEqual([
      'Lumina II',
      'Olympica',
      'Cinema 50',
    ])
    expect(titles(q({ price: { min: 1_000_000n, max: null } }))).toEqual([
      'MA352',
      'MC462',
      'Cinema 50',
    ])
    expect(titles(q({ price: { min: null, max: 1_000_000n } }))).toEqual(['Lumina II', 'Node'])
    expect(titles(q({ inStock: true }))).toEqual(['MA352', 'Lumina II', 'Cinema 50', 'Node'])
    expect(titles(q({ specs: { channels: [2] } }))).toEqual(['MA352', 'MC462'])
    expect(titles(q({ specs: { channels: [] } }))).toHaveLength(6)
    expect(titles(q({ brands: ['mcintosh'], inStock: true }))).toEqual(['MA352'])
  })

  it('counts each facet with every other filter applied (disjunctive)', () => {
    const { facets } = buildListing(ITEMS, q({ brands: ['mcintosh'], inStock: true }), {
      locale: 'en',
      specFacets: ['channels'],
    })
    // Brand counts ignore the brand filter but respect "in stock".
    expect(facets.brands.map((b) => [b.value, b.count, b.selected])).toEqual([
      ['bluesound', 1, false],
      ['marantz', 1, false],
      ['mcintosh', 1, true],
      ['sonus', 1, false],
    ])
    // Stock counts ignore the stock filter but respect the brand.
    expect(facets.inStock).toEqual({ count: 1, selected: true })
    expect(facets.specs).toEqual([]) // within McIntosh in stock, channels has one value only
    const wide = buildListing(ITEMS, q(), {
      locale: 'en',
      specFacets: ['channels', 'impedanceOhm', 'weightKg'],
    }).facets.specs
    expect(wide).toEqual([
      {
        key: 'channels',
        values: [
          { value: 2, count: 2, selected: false },
          { value: 9, count: 1, selected: false },
        ],
      },
      {
        key: 'impedanceOhm',
        values: [
          { value: 4, count: 2, selected: false },
          { value: 8, count: 1, selected: false },
        ],
      },
    ])
  })

  it('keeps a selected value visible even at zero', () => {
    const { facets } = buildListing(ITEMS, q({ brands: ['nobody'], specs: { channels: [7] } }), {
      locale: 'en',
      specFacets: ['channels'],
    })
    expect(facets.brands).toEqual([])
    expect(facets.specs[0]?.values.find((v) => v.value === 7)).toBeUndefined()
    const sel = buildListing(ITEMS, q({ specs: { channels: [9] }, brands: ['sonus'] }), {
      locale: 'en',
      specFacets: ['channels'],
    })
    expect(sel.facets.specs[0]?.values.find((v) => v.value === 9)).toEqual({
      value: 9,
      count: 0,
      selected: true,
    })
  })
})

describe('sorting', () => {
  it('featured follows merchandising order; newest the creation date', () => {
    expect(titles(q())).toEqual(['MA352', 'MC462', 'Lumina II', 'Olympica', 'Cinema 50', 'Node'])
    expect(titles(q({ sort: 'newest' }))).toEqual([
      'Node',
      'Cinema 50',
      'Olympica',
      'Lumina II',
      'MC462',
      'MA352',
    ])
  })

  it('puts price on request last in both price directions', () => {
    expect(titles(q({ sort: 'price-asc' }))).toEqual([
      'Node',
      'Lumina II',
      'Cinema 50',
      'MA352',
      'MC462',
      'Olympica',
    ])
    expect(titles(q({ sort: 'price-desc' }))).toEqual([
      'MC462',
      'MA352',
      'Cinema 50',
      'Lumina II',
      'Node',
      'Olympica',
    ])
  })

  it('sorts names with the locale collation', () => {
    const arabic = [item('ب', 'x', priced(1)), item('أ', 'x', priced(1)), item('ت', 'x', priced(1))]
    expect(
      buildListing(arabic, q({ sort: 'name' }), { locale: 'ar' }).items.map((i) => i.title),
    ).toEqual(['أ', 'ب', 'ت'])
    expect(titles(q({ sort: 'name' }))).toEqual([
      'Cinema 50',
      'Lumina II',
      'MA352',
      'MC462',
      'Node',
      'Olympica',
    ])
  })
})

describe('pagination', () => {
  it('pages results and flags a page past the end', () => {
    const page2 = buildListing(ITEMS, q({ page: 2 }), { locale: 'en', pageSize: 4 })
    expect([page2.page, page2.pages, page2.total, page2.outOfRange, page2.items.length]).toEqual([
      2,
      2,
      6,
      false,
      2,
    ])
    expect(buildListing(ITEMS, q({ page: 3 }), { locale: 'en', pageSize: 4 }).outOfRange).toBe(true)
    expect(buildListing([], q(), { locale: 'en' })).toMatchObject({
      pages: 1,
      total: 0,
      outOfRange: false,
    })
    expect(buildListing(ITEMS, q({ page: 0 }), { locale: 'en' }).page).toBe(1)
  })
})

describe('price bands', () => {
  it('rounds edges to readable amounts and covers every price', () => {
    expect([34_500, 2_399, 7_900, 11_500, 52_500].map(niceNumber)).toEqual([
      25_000, 2_500, 10_000, 10_000, 50_000,
    ])
    expect(niceNumber(0)).toBe(0)
    const bands = priceBands([239_900n, 790_000n, 1_150_000n, 3_450_000n, 5_250_000n], 2)
    expect(bands).toEqual([
      { min: null, max: 1_000_000n },
      { min: 1_000_000n, max: 2_500_000n },
      { min: 2_500_000n, max: null },
    ])
    for (const amount of [239_900n, 790_000n, 1_150_000n, 3_450_000n, 5_250_000n]) {
      expect(
        bands.filter(
          (b) => (b.min === null || amount >= b.min) && (b.max === null || amount < b.max),
        ),
      ).toHaveLength(1)
    }
  })

  it('has no bands with fewer than two prices, and works for 3-decimal currencies', () => {
    expect(priceBands([100n], 2)).toEqual([])
    expect(priceBands([100n, 100n], 2)).toEqual([])
    expect(priceBands([25_000n, 120_000n, 480_000n, 900_000n], 3)).toEqual([
      { min: null, max: 100_000n },
      { min: 100_000n, max: 500_000n },
      { min: 500_000n, max: null },
    ])
  })

  it('marks the selected band and counts it disjunctively', () => {
    const range = { min: null, max: 1_000_000n }
    const { facets } = buildListing(ITEMS, q({ price: range, brands: ['sonus'] }), { locale: 'en' })
    expect(facets.priceBands.find((b) => b.selected)).toEqual({
      value: range,
      count: 1,
      selected: true,
    })
    expect(sameRange(range, null)).toBe(false)
  })
})
