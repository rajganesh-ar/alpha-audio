import { describe, expect, it } from 'vitest'
import { EMPTY_LISTING_QUERY, buildListing, money, type ListingItem } from '@alpha/core'
import { MARKETS_SEED, resolveMarketRoute, type MarketRoute } from '@alpha/payload'
import { getDictionary, translator } from '@alpha/ui'
import type { Category } from '@/payload-types'
import {
  activeFilters,
  facetGroups,
  facetSpecsFor,
  formatPrice,
  isFiltered,
  listingHref,
  parseListingQuery,
  parsePrice,
} from './listing'

const route = resolveMarketRoute(MARKETS_SEED, 'ae', 'en') as MarketRoute
const kwd = { ...route.market, currency: 'KWD' as const, decimals: 3 as const }

describe('price parameter', () => {
  it('parses major-unit ranges into minor units and back', () => {
    expect(parsePrice('10000-25000', 2)).toEqual({ min: 1_000_000n, max: 2_500_000n })
    expect(parsePrice('-10000', 2)).toEqual({ min: null, max: 1_000_000n })
    expect(parsePrice('25000-', 3)).toEqual({ min: 25_000_000n, max: null })
    for (const bad of [null, '', '-', 'abc', '1-2-3', '5000-1000', '1.5-2', '10-10'])
      expect(parsePrice(bad, 2)).toBeNull()
    expect(formatPrice({ min: 1_000_000n, max: null }, 2)).toBe('10000-')
    expect(formatPrice({ min: null, max: 2_500_000n }, 3)).toBe('-2500')
  })
})

describe('parseListingQuery', () => {
  it('reads every parameter and ignores malformed ones', () => {
    const q = parseListingQuery(
      new URLSearchParams(
        'brand=mcintosh&brand=mcintosh&brand=Bad Slug&price=0-5000&stock=in&spec.channels=2&spec.channels=x&spec.unknown=1&sort=name&page=3',
      ),
      route.market,
    )
    expect(q).toEqual({
      brands: ['mcintosh'],
      price: { min: 0n, max: 500_000n },
      inStock: true,
      specs: { channels: [2] },
      sort: 'name',
      page: 3,
    })
    expect(
      parseListingQuery(new URLSearchParams('sort=cheapest&page=-1&stock=yes'), route.market),
    ).toEqual(EMPTY_LISTING_QUERY)
  })

  it('round-trips through listingHref, dropping defaults', () => {
    const q = parseListingQuery(
      new URLSearchParams('brand=a&price=10-&sort=price-asc&page=2&spec.powerW=200'),
      kwd,
    )
    expect(listingHref('/ae/en/shop/', q, kwd)).toBe(
      '/ae/en/shop/?brand=a&price=10-&spec.powerW=200&sort=price-asc&page=2',
    )
    expect(listingHref('/ae/en/shop/', EMPTY_LISTING_QUERY, kwd)).toBe('/ae/en/shop/')
  })

  it('knows what counts as filtered', () => {
    expect(isFiltered({ ...EMPTY_LISTING_QUERY, page: 4 })).toBe(false)
    expect(isFiltered({ ...EMPTY_LISTING_QUERY, sort: 'name' })).toBe(true)
    expect(
      activeFilters({
        ...EMPTY_LISTING_QUERY,
        brands: ['a', 'b'],
        inStock: true,
        specs: { channels: [2] },
      }),
    ).toBe(4)
  })
})

describe('facetSpecsFor', () => {
  it('uses the nearest category that defines facets', () => {
    const top = { id: 1, facetSpecs: ['channels'] } as unknown as Category
    const child = { id: 2, facetSpecs: [] } as unknown as Category
    expect(facetSpecsFor([top, child])).toEqual(['channels'])
    expect(facetSpecsFor([top, { ...child, facetSpecs: ['powerW'] }])).toEqual(['powerW'])
    expect(facetSpecsFor([])).toEqual([])
  })
})

describe('facetGroups', () => {
  it('labels bands with formatted money and specs with units, in both languages', () => {
    const item = (i: number, major: number, brand: string): ListingItem => ({
      id: i,
      title: `P${i}`,
      brand: { slug: brand, name: brand },
      price: {
        kind: 'priced',
        price: money(major * 100, 'AED', 2),
        vat: money(0, 'AED', 2),
        vatRate: 5,
      },
      specs: { impedanceOhm: i % 2 ? 4 : 8 },
      stock: 'in-stock',
      createdAt: '2026-01-01T00:00:00Z',
      position: i,
      data: null,
    })
    const items = [
      item(1, 2_400, 'a'),
      item(2, 7_900, 'b'),
      item(3, 18_500, 'a'),
      item(4, 34_500, 'b'),
    ]
    const result = buildListing(items, EMPTY_LISTING_QUERY, {
      locale: 'en',
      specFacets: ['impedanceOhm'],
    })
    const en = facetGroups(
      result.facets,
      EMPTY_LISTING_QUERY,
      route,
      translator(getDictionary('en')),
    )
    expect(en.map((g) => g.id)).toEqual(['brand', 'price', 'stock', 'spec-impedanceOhm'])
    expect(en[1]?.options.map((o) => o.label.replace(/\u00a0/g, ' '))).toEqual([
      'Any price',
      'Under AED 10,000',
      'AED 10,000 to AED 20,000',
      'AED 20,000 to AED 25,000',
      'AED 25,000 and above',
    ])
    expect(en[3]?.options.map((o) => o.label)).toEqual(['4 ohms', '8 ohms'])
    const arRoute = resolveMarketRoute(MARKETS_SEED, 'ae', 'ar') as MarketRoute
    const ar = facetGroups(
      result.facets,
      EMPTY_LISTING_QUERY,
      arRoute,
      translator(getDictionary('ar')),
    )
    for (const g of ar) for (const o of g.options) expect(o.label).not.toMatch(/[٠-٩]/)
  })
})
