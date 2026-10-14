import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { MARKETS_SEED } from '../system/seed-markets'
import { isLocaleCode, isMarketCode, marketForCountry, MARKET_CODES } from './codes'
import { getMarketsCached, invalidateMarketsCache, parseMarketsGlobal } from './read'
import { directionFor, languageTag, liveMarkets, resolveMarketRoute } from './resolve'
import type { MarketRecord } from './types'
import {
  isoMinorUnits,
  validateDecimals,
  validateLocales,
  validateTimezone,
  validateUniqueCodes,
  validateVatRate,
} from './validate'

const ae = MARKETS_SEED.find((m) => m.code === 'ae') as MarketRecord
const sa = MARKETS_SEED.find((m) => m.code === 'sa') as MarketRecord
const live = (m: MarketRecord): MarketRecord => ({ ...m, status: 'live' })

describe('codes', () => {
  it('recognises exactly the six GCC market codes', () => {
    expect([...MARKET_CODES].sort()).toEqual(['ae', 'bh', 'kw', 'om', 'qa', 'sa'])
    expect(isMarketCode('ae')).toBe(true)
    expect(isMarketCode('AE')).toBe(false) // URLs are lower-case
    expect(isMarketCode('xx')).toBe(false)
    expect(isLocaleCode('ar')).toBe(true)
    expect(isLocaleCode('fr')).toBe(false)
  })

  it.each([
    ['AE', 'ae'],
    ['sa', 'sa'],
    [' KW ', 'kw'],
    ['IN', null], // outside the GCC: no suggestion
    ['XX', null], // Cloudflare's unknown country
    ['T1', null], // Cloudflare's Tor exit
    ['', null],
    [null, null],
    [undefined, null],
  ])('marketForCountry(%s) → %s', (country, expected) => {
    expect(marketForCountry(country)).toBe(expected)
  })
})

describe('resolveMarketRoute', () => {
  const markets = [ae, sa] // ae live, sa soon

  it('accepts a live market and an enabled locale', () => {
    expect(resolveMarketRoute(markets, 'ae', 'ar')).toMatchObject({
      locale: 'ar',
      languageTag: 'ar-AE',
      dir: 'rtl',
      market: { code: 'ae' },
    })
    expect(resolveMarketRoute(markets, 'ae', 'en')).toMatchObject({ dir: 'ltr', languageTag: 'en-AE' })
  })

  it.each([
    ['xx', 'en', 'unknown market'],
    ['ae', 'fr', 'unknown locale'],
    ['sa', 'en', 'market not live'],
    ['om', 'en', 'market not in the record'],
    ['AE', 'en', 'upper-case code'],
    ['ae', 'EN', 'upper-case locale'],
  ])('rejects %s/%s (%s)', (market, locale) => {
    expect(resolveMarketRoute(markets, market, locale)).toBeNull()
  })

  it('rejects a locale the market does not offer', () => {
    const englishOnly: MarketRecord = { ...ae, locales: ['en'] }
    expect(resolveMarketRoute([englishOnly], 'ae', 'ar')).toBeNull()
    expect(resolveMarketRoute([englishOnly], 'ae', 'en')).not.toBeNull()
  })

  it('follows status: switching a market live makes it routable', () => {
    expect(resolveMarketRoute([ae, live(sa)], 'sa', 'ar')).toMatchObject({ languageTag: 'ar-SA' })
  })

  it('derives direction from the language and tags from the market', () => {
    expect(directionFor('ar')).toBe('rtl')
    expect(directionFor('en')).toBe('ltr')
    expect(languageTag('en', sa)).toBe('en-SA')
    expect(liveMarkets(markets).map((m) => m.code)).toEqual(['ae'])
  })
})

describe('validators', () => {
  it('reads ISO 4217 minor units from Intl', () => {
    expect(isoMinorUnits('AED')).toBe(2)
    expect(isoMinorUnits('KWD')).toBe(3)
    expect(isoMinorUnits('BHD')).toBe(3)
    expect(isoMinorUnits('OMR')).toBe(3)
    expect(isoMinorUnits('not-a-currency')).toBeNull()
  })

  it('ties decimals to the currency', () => {
    expect(validateDecimals(3, 'KWD')).toBe(true)
    expect(validateDecimals(2, 'KWD')).toMatch(/KWD has 3 decimal places/)
    expect(validateDecimals(2.5, 'AED')).toMatch(/whole number/)
    expect(validateDecimals(4, 'AED')).toMatch(/0 to 3/)
    expect(validateDecimals(undefined, 'AED')).toMatch(/whole number/)
  })

  it('checks VAT rates', () => {
    expect(validateVatRate(5)).toBe(true)
    expect(validateVatRate(0)).toBe(true)
    expect(validateVatRate(2.5)).toBe(true)
    expect(validateVatRate(2.555)).toMatch(/two decimal/)
    expect(validateVatRate(-1)).toMatch(/between 0 and 100/)
    expect(validateVatRate(null)).toMatch(/required/)
  })

  it('checks IANA time zones', () => {
    expect(validateTimezone('Asia/Dubai')).toBe(true)
    expect(validateTimezone('Asia/Atlantis')).toMatch(/not an IANA time zone/)
    expect(validateTimezone('')).toMatch(/required/)
  })

  it('rejects duplicate market codes and empty locales', () => {
    expect(validateUniqueCodes([{ code: 'ae' }, { code: 'sa' }])).toBe(true)
    expect(validateUniqueCodes([{ code: 'ae' }, { code: 'ae' }])).toMatch(/"ae" appears more/)
    expect(validateLocales([])).toMatch(/at least one/)
    expect(validateLocales(['en'])).toBe(true)
  })
})

describe('MARKETS_SEED', () => {
  it('has one row per market code', () => {
    expect(MARKETS_SEED.map((m) => m.code).sort()).toEqual([...MARKET_CODES].sort())
    expect(validateUniqueCodes(MARKETS_SEED)).toBe(true)
  })

  it.each(MARKETS_SEED.map((m) => [m.code, m] as const))('%s passes every validator', (_c, m) => {
    expect(validateDecimals(m.decimals, m.currency)).toBe(true)
    expect(validateVatRate(m.vatRate)).toBe(true)
    expect(validateTimezone(m.timezone)).toBe(true)
    expect(validateLocales(m.locales)).toBe(true)
    expect(m.name.en.length).toBeGreaterThan(0)
    expect(m.name.ar.length).toBeGreaterThan(0)
  })

  it('matches the spec values for VAT and decimals', () => {
    const byCode = Object.fromEntries(MARKETS_SEED.map((m) => [m.code, m]))
    expect(byCode['ae']).toMatchObject({ currency: 'AED', decimals: 2, vatRate: 5, status: 'live' })
    expect(byCode['sa']).toMatchObject({ currency: 'SAR', decimals: 2, vatRate: 15 })
    expect(byCode['qa']).toMatchObject({ currency: 'QAR', decimals: 2, vatRate: 0 })
    expect(byCode['kw']).toMatchObject({ currency: 'KWD', decimals: 3, vatRate: 0 })
    expect(byCode['bh']).toMatchObject({ currency: 'BHD', decimals: 3, vatRate: 10 })
    expect(byCode['om']).toMatchObject({ currency: 'OMR', decimals: 3, vatRate: 5 })
  })

  it('launches UAE only; every other market waits for its phase', () => {
    expect(liveMarkets(MARKETS_SEED).map((m) => m.code)).toEqual(['ae'])
  })
})

describe('parseMarketsGlobal', () => {
  it('parses a stored global', () => {
    expect(parseMarketsGlobal({ markets: [ae] })).toEqual([ae])
    expect(parseMarketsGlobal({ markets: null })).toEqual([])
    expect(parseMarketsGlobal({})).toEqual([])
  })

  it('refuses a malformed record with the path of the problem', () => {
    expect(() => parseMarketsGlobal({ markets: [{ ...ae, vatRate: 'five' }] })).toThrow(
      /markets\.0\.vatRate/,
    )
    expect(() => parseMarketsGlobal({ markets: [{ ...ae, name: { en: 'UAE' } }] })).toThrow(
      /markets\.0\.name\.ar/,
    )
  })
})

describe('getMarketsCached', () => {
  function fakePayload(markets: MarketRecord[]) {
    const findGlobal = vi.fn(async () => ({ markets }))
    return { payload: { findGlobal } as unknown as Payload, findGlobal }
  }

  it('reads once per TTL and again after invalidation', async () => {
    invalidateMarketsCache()
    const { payload, findGlobal } = fakePayload([ae])
    let t = 1_000
    const now = () => t
    await getMarketsCached(payload, 30_000, now)
    await getMarketsCached(payload, 30_000, now)
    expect(findGlobal).toHaveBeenCalledTimes(1)

    t += 30_001
    await getMarketsCached(payload, 30_000, now)
    expect(findGlobal).toHaveBeenCalledTimes(2)

    invalidateMarketsCache()
    await getMarketsCached(payload, 30_000, now)
    expect(findGlobal).toHaveBeenCalledTimes(3)
  })

  it('reads with all locales and normal access rules', async () => {
    invalidateMarketsCache()
    const { payload, findGlobal } = fakePayload([ae])
    await getMarketsCached(payload)
    expect(findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'markets', locale: 'all', overrideAccess: false }),
    )
  })
})
