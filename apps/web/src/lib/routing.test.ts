import { describe, expect, it } from 'vitest'
import { decideRoute, suggestedMarketUpdate } from './routing'

const at = (path: string) => decideRoute(new URL(path, 'https://alphaaudios.com'))

describe('decideRoute', () => {
  it.each([
    ['/', '/ae/en/'],
    ['/?utm_source=ig', '/ae/en/?utm_source=ig'],
    ['/ae', '/ae/en/'],
    ['/ae/', '/ae/en/'],
    ['/sa', '/sa/en/'], // shape only; the record decides whether sa is live
    ['/ae/en', '/ae/en/'],
    ['/ae/ar/brands', '/ae/ar/brands/'],
    ['/AE/EN/', '/ae/en/'],
    ['/AE/AR', '/ae/ar/'], // case and slash in a single hop
    ['/Ae/en/brands/McIntosh/', '/ae/en/brands/McIntosh/'], // only the codes are lower-cased
    ['/ae/en?x=1', '/ae/en/?x=1'],
  ])('%s → 308 %s', (path, location) => {
    expect(at(path)).toEqual({ kind: 'redirect', location, status: 308 })
  })

  it.each([
    ['/ae/en/', 'ae', 'en'],
    ['/ae/ar/brands/', 'ae', 'ar'],
    ['/sa/en/', 'sa', 'en'],
    ['/ae/fr/', 'ae', 'fr'],
    ['/ae/fr', 'ae', 'fr'], // unknown locale: no slash redirect, straight to the record check
    ['/ae/FR/', 'ae', 'FR'],
  ])('%s → market check %s/%s', (path, market, locale) => {
    expect(at(path)).toEqual({ kind: 'market', market, locale })
  })

  it.each([['/xx/en/'], ['/foo/bar/'], ['/en/ae/']])('%s → 404 (no market can match)', (path) => {
    expect(at(path)).toEqual({ kind: 'not-found' })
  })

  it.each([
    ['/brand?bid=13', 'next'],
    ['/collection?catid=53&utm_source=x', 'next'],
    ['/?bid=13', 'next'],
    ['/old/brand?bid=13', 'not-found'],
  ])('%s → legacy lookup, then %s', (path, fallback) => {
    expect(at(path)).toEqual({ kind: 'legacy', fallback })
  })

  it.each([['/brand'], ['/nothing-here'], ['/brand?utm_source=x']])('%s → next', (path) => {
    expect(at(path)).toEqual({ kind: 'next' })
  })

  it('never treats a storefront URL as legacy', () => {
    expect(at('/ae/en/?bid=13')).toEqual({ kind: 'market', market: 'ae', locale: 'en' })
  })
})

describe('suggestedMarketUpdate', () => {
  it.each([
    ['SA', undefined, 'sa'],
    ['SA', 'ae', 'sa'], // moved country
    ['SA', 'sa', null], // already set: no Set-Cookie, so the CDN can cache
    ['AE', undefined, 'ae'],
    ['IN', undefined, null],
    ['XX', undefined, null],
    [null, undefined, null],
  ])('country %s, cookie %s → %s', (country, current, expected) => {
    expect(suggestedMarketUpdate(country, current)).toBe(expected)
  })
})

describe('shop listing twin', () => {
  it('rewrites a listing with filter, sort or page parameters to its dynamic twin', () => {
    expect(at('/ae/en/shop/amplifiers/?brand=mcintosh')).toEqual({
      kind: 'market',
      market: 'ae',
      locale: 'en',
      rewrite: '/ae/en/shop-results/amplifiers/',
    })
    expect(at('/ae/ar/shop/?page=2')).toMatchObject({ rewrite: '/ae/ar/shop-results/' })
    expect(at('/ae/en/shop/a/b/?spec.channels=2')).toMatchObject({
      rewrite: '/ae/en/shop-results/a/b/',
    })
    for (const q of ['sort=name', 'price=0-1000', 'stock=in'])
      expect(at(`/ae/en/shop/?${q}`)).toHaveProperty('rewrite')
  })

  it('leaves unfiltered listings and other pages alone, tracking parameters included', () => {
    expect(at('/ae/en/shop/amplifiers/')).toEqual({ kind: 'market', market: 'ae', locale: 'en' })
    expect(at('/ae/en/shop/?utm_source=x')).not.toHaveProperty('rewrite')
    expect(at('/ae/en/products/x/?brand=y')).not.toHaveProperty('rewrite')
  })

  it('leaves the staff ops screens to their own route group', () => {
    expect(at('/ops/orders/')).toEqual({ kind: 'next' })
    expect(at('/ops/orders/AE-2026-000001/')).toEqual({ kind: 'next' })
    expect(at('/opsx/orders/')).toEqual({ kind: 'not-found' })
  })

  it('404s direct requests for the twin', () => {
    expect(at('/ae/en/shop-results/amplifiers/')).toEqual({ kind: 'not-found' })
    expect(at('/ae/en/shop-results/?brand=x')).toEqual({ kind: 'not-found' })
  })

  it('drops no-op values a filter form submits, in one redirect', () => {
    expect(at('/ae/en/shop/?brand=mcintosh&price=&sort=featured')).toEqual({
      kind: 'redirect',
      location: '/ae/en/shop/?brand=mcintosh',
      status: 308,
    })
    expect(at('/ae/en/shop/x/?price=&page=1&utm_source=ig')).toEqual({
      kind: 'redirect',
      location: '/ae/en/shop/x/?utm_source=ig',
      status: 308,
    })
    expect(at('/ae/en/shop/?sort=featured')).toEqual({
      kind: 'redirect',
      location: '/ae/en/shop/',
      status: 308,
    })
    expect(at('/ae/en/shop/?sort=name&page=2')).toHaveProperty('rewrite')
  })

  it('canonicalises first, then rewrites', () => {
    expect(at('/AE/EN/shop?brand=x')).toEqual({
      kind: 'redirect',
      location: '/ae/en/shop/?brand=x',
      status: 308,
    })
  })
})
