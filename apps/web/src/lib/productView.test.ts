import { describe, expect, it } from 'vitest'
import { money } from '@alpha/core'
import { MARKETS_SEED, resolveMarketRoute, type MarketRoute } from '@alpha/payload'
import { getDictionary, translator } from '@alpha/ui'
import type { Product } from '@/payload-types'
import { mediaPath, priceOf, productJsonLd, specRows } from './productView'

process.env['NEXT_PUBLIC_SERVER_URL'] ??= 'http://localhost:3000'

const route = (locale: 'en' | 'ar') => resolveMarketRoute(MARKETS_SEED, 'ae', locale) as MarketRoute
const brand = {
  id: 1,
  name: 'McIntosh',
  slug: 'mcintosh',
  priceDisplay: 'show',
  arabicReview: 'draft',
  updatedAt: '',
  createdAt: '',
} as const
const product = (patch: Partial<Product> = {}): Product =>
  ({
    id: 1,
    title: 'MA352 integrated amplifier',
    slug: 'mcintosh-ma352',
    sku: 'MCINTOSH-MA352',
    brand,
    lifecycle: 'active',
    arabicReview: 'draft',
    summary: 'Hybrid amplifier.',
    specs: {
      powerW: 200,
      channels: 2,
      impedanceOhm: 8,
      weightKg: 29.5,
      frequencyLowHz: 20,
      frequencyHighHz: 20000,
      dimensionsMm: { width: 445, height: 193, depth: 559 },
    },
    markets: [{ market: 'ae', published: true, rrpInclVat: 3_450_000, priceDisplay: 'show' }],
    gallery: [
      {
        id: 9,
        alt: 'Front',
        url: 'http://localhost:3000/api/media/file/a.webp',
        width: 1600,
        height: 1200,
        updatedAt: '',
        createdAt: '',
      },
    ],
    updatedAt: '',
    createdAt: '',
    ...patch,
  }) as Product

describe('specRows', () => {
  it('formats with units and Western digits in both languages', () => {
    const en = specRows(product(), translator(getDictionary('en')), route('en'))
    expect(en).toEqual([
      { label: 'Power', value: '200 W per channel' },
      { label: 'Channels', value: '2' },
      { label: 'Nominal impedance', value: '8 ohms' },
      { label: 'Frequency response', value: '20 Hz to 20 kHz' },
      { label: 'Dimensions (W × H × D)', value: '445 × 193 × 559 mm' },
      { label: 'Weight', value: '29.5 kg' },
      { label: 'Model code', value: 'MCINTOSH-MA352' },
    ])
    const ar = specRows(product(), translator(getDictionary('ar')), route('ar'))
    for (const row of ar) expect(row.value).not.toMatch(/[٠-٩۰-۹]/)
    expect(ar[0]?.value).toBe('200 واط لكل قناة')
  })

  it('hides empty specs', () => {
    expect(specRows(product({ specs: {} }), translator(getDictionary('en')), route('en'))).toEqual([
      { label: 'Model code', value: 'MCINTOSH-MA352' },
    ])
  })
})

describe('priceOf', () => {
  it('reads the market price, and the brand policy wins', () => {
    expect(priceOf(product(), route('en'))).toMatchObject({
      kind: 'priced',
      price: money(3_450_000, 'AED', 2),
    })
    expect(
      priceOf(product({ brand: { ...brand, priceDisplay: 'request' } }), route('en')).kind,
    ).toBe('request')
    expect(
      priceOf(product({ markets: [{ market: 'sa', published: true, rrpInclVat: 1 }] }), route('en'))
        .kind,
    ).toBe('unavailable')
  })
})

describe('mediaPath', () => {
  it('turns own-origin media URLs into paths and leaves others alone', () => {
    const origin = new URL('http://localhost:3000')
    expect(mediaPath('http://localhost:3000/api/media/file/a.webp', origin)).toBe(
      '/api/media/file/a.webp',
    )
    expect(mediaPath('/api/media/file/a.webp?v=2', origin)).toBe('/api/media/file/a.webp?v=2')
    expect(mediaPath('https://cdn.example.com/a.webp', origin)).toBe(
      'https://cdn.example.com/a.webp',
    )
  })
})

describe('productJsonLd', () => {
  const origin = new URL('https://alphaaudios.com')
  it('omits offers when the price is on request', () => {
    const p = product({ markets: [{ market: 'ae', published: true, priceDisplay: 'request' }] })
    const ld = productJsonLd({
      product: p,
      route: route('en'),
      url: 'https://alphaaudios.com/ae/en/products/x/',
      origin,
      price: priceOf(p, route('en')),
      stock: undefined,
    })
    expect(ld).not.toHaveProperty('offers')
    expect(ld).toMatchObject({
      '@type': 'Product',
      name: 'MA352 integrated amplifier',
      brand: { name: 'McIntosh' },
    })
  })
})
