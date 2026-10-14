import { describe, expect, it } from 'vitest'
import { MARKETS_SEED, type MarketRecord } from '@alpha/payload'
import { alternatesFor, hreflangLinks, jsonLd, localizedPath, siteUrl } from './seo'

const byCode = (code: string) => MARKETS_SEED.find((m) => m.code === code) as MarketRecord
const live = (m: MarketRecord): MarketRecord => ({ ...m, status: 'live' })

describe('localizedPath', () => {
  it.each([
    ['/', '/ae/en/'],
    ['', '/ae/en/'],
    ['brands/mcintosh', '/ae/en/brands/mcintosh/'],
    ['/brands/mcintosh/', '/ae/en/brands/mcintosh/'],
    ['//brands//', '/ae/en/brands/'],
  ])('%s → %s', (path, expected) => {
    expect(localizedPath('ae', 'en', path)).toBe(expected)
  })
})

describe('hreflangLinks', () => {
  it('emits every live market × locale and x-default = /ae/en/ (launch: UAE only)', () => {
    expect(hreflangLinks(MARKETS_SEED)).toEqual([
      { hrefLang: 'en-AE', href: '/ae/en/' },
      { hrefLang: 'ar-AE', href: '/ae/ar/' },
      { hrefLang: 'x-default', href: '/ae/en/' },
    ])
  })

  it('grows with the record when a market goes live', () => {
    const markets = MARKETS_SEED.map((m) => (m.code === 'sa' || m.code === 'kw' ? live(m) : m))
    const links = hreflangLinks(markets, '/brands/mcintosh/')
    expect(links.map((l) => l.hrefLang)).toEqual([
      'en-AE',
      'ar-AE',
      'en-SA',
      'ar-SA',
      'en-KW',
      'ar-KW',
      'x-default',
    ])
    expect(links.find((l) => l.hrefLang === 'ar-SA')?.href).toBe('/sa/ar/brands/mcintosh/')
    expect(links.at(-1)).toEqual({ hrefLang: 'x-default', href: '/ae/en/brands/mcintosh/' })
  })

  it('respects a market that offers one language only', () => {
    const englishOnlyQatar: MarketRecord = { ...live(byCode('qa')), locales: ['en'] }
    const tags = hreflangLinks([byCode('ae'), englishOnlyQatar]).map((l) => l.hrefLang)
    expect(tags).toContain('en-QA')
    expect(tags).not.toContain('ar-QA')
  })

  it('never lists a market that is not live', () => {
    const tags = hreflangLinks(MARKETS_SEED).map((l) => l.hrefLang)
    expect(tags.some((t) => t.endsWith('-SA') || t.endsWith('-OM'))).toBe(false)
  })
})

describe('alternatesFor', () => {
  it('is self-canonical and carries the hreflang set', () => {
    const ae = byCode('ae')
    expect(alternatesFor(MARKETS_SEED, { market: ae, locale: 'ar' }, '/rooms/')).toEqual({
      canonical: '/ae/ar/rooms/',
      languages: {
        'en-AE': '/ae/en/rooms/',
        'ar-AE': '/ae/ar/rooms/',
        'x-default': '/ae/en/rooms/',
      },
    })
  })
})

describe('siteUrl', () => {
  it('reads the public origin and refuses to guess one', () => {
    expect(siteUrl({ NEXT_PUBLIC_SERVER_URL: 'https://alphaaudios.com' }).origin).toBe(
      'https://alphaaudios.com',
    )
    expect(() => siteUrl({})).toThrow(/NEXT_PUBLIC_SERVER_URL/)
  })
})

describe('hreflang for pages published in some markets only', () => {
  const markets = MARKETS_SEED.map((m) => (m.code === 'sa' ? live(m) : m))

  it('lists only the markets the page is published in', () => {
    const links = hreflangLinks(markets, '/products/x/', (m) => m.code === 'ae')
    expect(links.map((l) => l.hrefLang)).toEqual(['en-AE', 'ar-AE', 'x-default'])
  })

  it('points x-default at the first published market when the default market lacks the page', () => {
    const links = hreflangLinks(markets, '/products/x/', (m) => m.code === 'sa')
    expect(links.at(-1)).toEqual({ hrefLang: 'x-default', href: '/sa/en/products/x/' })
  })

  it('emits nothing when the page is published nowhere live', () => {
    expect(hreflangLinks(markets, '/products/x/', () => false)).toEqual([])
  })
})

describe('jsonLd', () => {
  it('cannot be closed early by content', () => {
    const out = jsonLd({ name: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' })
  })
})
