import {
  consumerPrice,
  schemaAvailability,
  toDecimalString,
  type ConsumerPrice,
  type StockPromise,
} from '@alpha/core'
import type { MarketRoute } from '@alpha/payload'
import type { SpecRow, Translate } from '@alpha/ui'
import type { Brand, Category, Media, Product } from '@/payload-types'
import type { LiveStockLabels } from '@/components/LiveStockLine'
import { localizedPath, siteUrl } from './seo'

/** Storefront view helpers: Payload documents in, display values out. No computation of money. */

export interface ProductImage {
  url: string
  width: number
  height: number
  alt: string
}

const isMedia = (value: unknown): value is Media =>
  typeof value === 'object' && value !== null && 'url' in value

/**
 * Payload writes media URLs against its `serverURL`. On our own origin they become paths, so
 * `next/image` serves them as local images (optimised, no remote-pattern allowance needed).
 */
export function mediaPath(url: string, origin: URL = siteUrl()): string {
  const parsed = new URL(url, origin)
  return parsed.origin === origin.origin ? `${parsed.pathname}${parsed.search}` : parsed.toString()
}

export function imageOf(media: number | Media | null | undefined): ProductImage | null {
  if (!isMedia(media) || !media.url || !media.width || !media.height) return null
  return { url: mediaPath(media.url), width: media.width, height: media.height, alt: media.alt }
}

export const productImages = (product: Product): ProductImage[] =>
  (product.gallery ?? []).map(imageOf).filter((i): i is ProductImage => i !== null)

export const brandOf = (product: Product): Brand | null =>
  typeof product.brand === 'object' ? product.brand : null

export const categoriesOf = (product: Product): Category[] =>
  (product.categories ?? []).filter((c): c is Category => typeof c === 'object' && c !== null)

export const priceOf = (product: Product, route: MarketRoute): ConsumerPrice =>
  consumerPrice({
    market: route.market,
    entries: product.markets,
    brandPriceDisplay: brandOf(product)?.priceDisplay,
  })

export const productPath = (route: Pick<MarketRoute, 'market' | 'locale'>, slug: string): string =>
  localizedPath(route.market.code, route.locale, `/products/${slug}`)

/** Western digits in every locale (CLAUDE.md), with the locale's separators. */
export const numberLocale = (route: MarketRoute): string => `${route.languageTag}-u-nu-latn`

export function specRows(product: Product, t: Translate, route: MarketRoute): SpecRow[] {
  const n = new Intl.NumberFormat(numberLocale(route), { maximumFractionDigits: 2 })
  const s = product.specs ?? {}
  const rows: SpecRow[] = []
  const add = (label: string, value: string | null) => {
    if (value) rows.push({ label, value })
  }
  const num = (v: number | null | undefined) => (typeof v === 'number' ? n.format(v) : null)
  const hz = (v: number) =>
    v >= 1000
      ? t('product.spec.khzValue', { value: n.format(v / 1000) })
      : t('product.spec.hzValue', { value: n.format(v) })

  if (s.powerW)
    add(t('product.spec.power'), t('product.spec.powerValue', { value: n.format(s.powerW) }))
  add(t('product.spec.channels'), num(s.channels))
  if (s.impedanceOhm)
    add(
      t('product.spec.impedance'),
      t('product.spec.ohmValue', { value: n.format(s.impedanceOhm) }),
    )
  if (s.minImpedanceOhm)
    add(
      t('product.spec.minImpedance'),
      t('product.spec.ohmValue', { value: n.format(s.minImpedanceOhm) }),
    )
  if (s.sensitivityDb)
    add(
      t('product.spec.sensitivity'),
      t('product.spec.sensitivityValue', { value: n.format(s.sensitivityDb) }),
    )
  if (s.frequencyLowHz && s.frequencyHighHz) {
    add(
      t('product.spec.frequency'),
      t('product.spec.frequencyValue', { low: hz(s.frequencyLowHz), high: hz(s.frequencyHighHz) }),
    )
  }
  if (s.inputs) add(t('product.spec.inputs'), s.inputs)
  const d = s.dimensionsMm
  if (d?.width && d.height && d.depth) {
    add(
      t('product.spec.dimensions'),
      t('product.spec.dimensionsValue', {
        width: n.format(d.width),
        height: n.format(d.height),
        depth: n.format(d.depth),
      }),
    )
  }
  if (s.weightKg)
    add(t('product.spec.weight'), t('product.spec.weightValue', { value: n.format(s.weightKg) }))
  add(t('product.spec.sku'), product.sku)
  return rows
}

export const stockLabels = (t: Translate): LiveStockLabels => ({
  'in-stock': t('stock.inStock'),
  low: t('stock.low'),
  'on-order': t('stock.onOrder'),
  out: t('stock.out'),
  eta: t('stock.eta', { date: '{date}' }),
  onOrderNoDate: t('stock.onOrderNoDate'),
})

export const liveStock = (promise: StockPromise | undefined) => ({
  status: promise?.status ?? 'out',
  eta: promise?.eta?.toISOString() ?? null,
})

/** schema.org Product + Offer. `offers` only when the product has a public price. */
export function productJsonLd(input: {
  product: Product
  route: MarketRoute
  url: string
  origin: URL
  price: ConsumerPrice
  stock: StockPromise | undefined
}) {
  const { product, route, url, origin, price, stock } = input
  const brand = brandOf(product)
  const images = productImages(product).map((i) => new URL(i.url, origin).toString())
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    sku: product.sku,
    url,
    ...(product.summary ? { description: product.summary } : {}),
    ...(images.length ? { image: images } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand.name } } : {}),
    ...(price.kind === 'priced'
      ? {
          offers: {
            '@type': 'Offer',
            url,
            price: toDecimalString(price.price.amount, price.price.decimals),
            priceCurrency: price.price.currency,
            availability: schemaAvailability(stock?.status ?? 'out'),
            itemCondition: 'https://schema.org/NewCondition',
            eligibleRegion: { '@type': 'Country', name: route.market.code.toUpperCase() },
            seller: { '@type': 'Organization', name: 'Alpha Audio' },
          },
        }
      : {}),
  }
}

export function breadcrumbJsonLd(items: ReadonlyArray<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/** schema.org Brand for a brand page. */
export function brandJsonLd(input: {
  name: string
  url: string
  description?: string | null | undefined
  logo?: string | null | undefined
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Brand',
    name: input.name,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    ...(input.logo ? { logo: input.logo } : {}),
  }
}
