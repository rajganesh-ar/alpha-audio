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
