import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { stockPromise, type StockPromiseStatus } from '@alpha/core'
import { MARKETS_SEED, resolveMarketRoute, type MarketRoute } from '@alpha/payload'
import type { Product } from '@/payload-types'
import { breadcrumbJsonLd, priceOf, productJsonLd } from './productView'

/**
 * Schema test for the product page's structured data (spec: "validated in CI with a schema
 * test"). The schema encodes Google's Product rich-result requirements for a merchant listing:
 * name, image, and an Offer with a decimal price, an ISO 4217 currency and a schema.org
 * availability URL. `availability` must follow the ledger's sellable count.
 */
const absoluteUrl = z.string().url().startsWith('https://')
const Availability = z.enum([
  'https://schema.org/InStock',
  'https://schema.org/LimitedAvailability',
  'https://schema.org/BackOrder',
  'https://schema.org/OutOfStock',
])
const ProductLd = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('Product'),
  name: z.string().min(1),
  sku: z.string().min(1),
  url: absoluteUrl,
  description: z.string().min(1).optional(),
  image: z.array(absoluteUrl).min(1),
  brand: z.object({ '@type': z.literal('Brand'), name: z.string().min(1) }),
  offers: z.object({
    '@type': z.literal('Offer'),
    url: absoluteUrl,
    price: z.string().regex(/^\d+(\.\d{1,3})?$/),
    priceCurrency: z.string().regex(/^[A-Z]{3}$/),
    availability: Availability,
    itemCondition: z.literal('https://schema.org/NewCondition'),
  }),
})
const BreadcrumbLd = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('BreadcrumbList'),
  itemListElement: z
    .array(
      z.object({
        '@type': z.literal('ListItem'),
        position: z.number().int().positive(),
        name: z.string().min(1),
        item: absoluteUrl,
      }),
    )
    .min(2),
})

process.env['NEXT_PUBLIC_SERVER_URL'] ??= 'https://alphaaudios.com'
const route = resolveMarketRoute(MARKETS_SEED, 'ae', 'en') as MarketRoute
const origin = new URL('https://alphaaudios.com')
const url = 'https://alphaaudios.com/ae/en/products/mcintosh-ma352/'
const product = {
  id: 1,
  title: 'MA352 integrated amplifier',
  slug: 'mcintosh-ma352',
  sku: 'MCINTOSH-MA352',
  summary: 'Hybrid amplifier.',
  brand: { id: 1, name: 'McIntosh', slug: 'mcintosh', priceDisplay: 'show' },
  markets: [{ market: 'ae', published: true, rrpInclVat: 3_450_000, priceDisplay: 'show' }],
  gallery: [{ id: 2, alt: 'Front', url: '/api/media/file/a.webp', width: 1600, height: 1200 }],
} as unknown as Product

const SELLABLE: Array<[number, Date | null, StockPromiseStatus, string]> = [
  [9, null, 'in-stock', 'https://schema.org/InStock'],
  [1, null, 'low', 'https://schema.org/LimitedAvailability'],
  [0, new Date('2099-01-01T00:00:00Z'), 'on-order', 'https://schema.org/BackOrder'],
  [0, null, 'out', 'https://schema.org/OutOfStock'],
]

describe('product JSON-LD', () => {
  it.each(SELLABLE)(
    'validates, with availability following sellable = %i',
    (sellable, eta, status, availability) => {
      const stock = stockPromise({ sellable, eta })
      expect(stock.status).toBe(status)
      const ld = ProductLd.parse(
        productJsonLd({ product, route, url, origin, price: priceOf(product, route), stock }),
      )
      expect(ld.offers).toMatchObject({ price: '34500.00', priceCurrency: 'AED', availability })
      expect(ld.image).toEqual(['https://alphaaudios.com/api/media/file/a.webp'])
    },
  )

  it('breadcrumbs validate', () => {
    BreadcrumbLd.parse(
      breadcrumbJsonLd([
        { name: 'Home', url: 'https://alphaaudios.com/ae/en/' },
        { name: 'Amplifiers', url: 'https://alphaaudios.com/ae/en/shop/amplifiers/' },
        { name: 'MA352', url },
      ]),
    )
  })
})
