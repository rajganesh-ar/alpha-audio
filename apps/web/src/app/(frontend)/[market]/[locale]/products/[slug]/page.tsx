import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { publishedIn } from '@alpha/core'
import { Breadcrumb, Gallery, PriceBlock, SpecTable, getDictionary, translator } from '@alpha/ui'
import { LiveStockLine } from '@/components/LiveStockLine'
import { categoryTrail, getCategories, getProduct } from '@/lib/catalog'
import { getMarketRoute, getMarkets, requireMarketRoute } from '@/lib/markets'
import {
  brandOf,
  breadcrumbJsonLd,
  categoriesOf,
  liveStock,
  numberLocale,
  priceOf,
  productImages,
  productJsonLd,
  productPath,
  specRows,
  stockLabels,
} from '@/lib/productView'
import { alternatesFor, jsonLd, localizedPath, siteUrl } from '@/lib/seo'
import { stockPromises } from '@/lib/stock'

type Params = Promise<{ market: string; locale: string; slug: string }>

// ISR: rendered on first request, expired by the catalogue hooks on publish, and re-rendered at
// most every five minutes so the server-rendered stock line and JSON-LD availability stay close
// to the ledger. The live stock line refreshes in the browser regardless.
export const revalidate = 300
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale, slug } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  const product = await getProduct(slug, route.locale)
  if (!product || !publishedIn(product.markets, route.market.code)) return {}
  const brand = brandOf(product)
  const title = product.seo?.title || [brand?.name, product.title].filter(Boolean).join(' ')
  return {
    title,
    description: product.seo?.description || product.summary || undefined,
    alternates: alternatesFor(await getMarkets(), route, `/products/${product.slug}`, (m) =>
      publishedIn(product.markets, m.code),
    ),
    openGraph: {
      title,
      type: 'website',
      images: productImages(product)
        .slice(0, 1)
        .map((i) => ({ url: i.url, width: i.width, height: i.height, alt: i.alt })),
    },
  }
}

export default async function ProductPage({ params }: { params: Params }) {
  const route = await requireMarketRoute(params)
  const { slug } = await params
  const product = await getProduct(slug, route.locale)
  // Not sold here: a 404 with the market switcher, never a redirect to another market (spec).
  if (!product || !publishedIn(product.markets, route.market.code)) notFound()

  const t = translator(getDictionary(route.locale))
  const brand = brandOf(product)
  const price = priceOf(product, route)
  const images = productImages(product)
  const stock = (await stockPromises([product.sku], route.market.code)).get(product.sku)
  const origin = siteUrl()
  const home = localizedPath(route.market.code, route.locale)
  const url = new URL(productPath(route, product.slug), origin).toString()

  const trail = categoryTrail(await getCategories(route.locale), categoriesOf(product)[0]?.id)
  const crumbs = [
    { label: t('ui.home'), href: home },
    ...trail.map((c) => ({
      label: c.title,
      href: localizedPath(route.market.code, route.locale, `/shop/${c.slug}`),
    })),
    { label: product.title },
  ]

  return (
    <article className="flex flex-col gap-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            productJsonLd({ product, route, url, origin, price, stock }),
            breadcrumbJsonLd(
              crumbs.map((c) => ({
                name: c.label,
                url: new URL(c.href ?? productPath(route, product.slug), origin).toString(),
              })),
            ),
          ]),
        }}
      />
      <Breadcrumb label={t('ui.breadcrumb')} items={crumbs} />
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Gallery
            label={t('product.gallery')}
            thumbnailLabel={t('product.galleryThumb')}
            emptyLabel={t('product.galleryEmpty')}
            slides={images.map((image, index) => ({
              id: image.url,
              media: (
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  sizes="(min-width: 64rem) 58vw, 100vw"
                  priority={index === 0}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                />
              ),
              thumb: <Image src={image.url} alt="" fill sizes="64px" />,
            }))}
          />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-5">
          <header className="flex flex-col gap-2">
            {brand ? (
              <p className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
                {brand.name}
              </p>
            ) : null}
            <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
              {product.title}
            </h1>
            {product.summary ? <p className="text-lg text-ink-muted">{product.summary}</p> : null}
          </header>
          <PriceBlock
            size="lg"
            locale={route.languageTag}
            price={price.kind === 'priced' ? price.price : null}
            vatLabel={
              price.kind === 'priced' ? t('price.inclVat', { rate: price.vatRate }) : undefined
            }
            requestLabel={t('price.onRequest')}
          />
          <LiveStockLine
            market={route.market.code}
            sku={product.sku}
            initial={liveStock(stock)}
            labels={stockLabels(t)}
            dateLocale={numberLocale(route)}
            timeZone={route.market.timezone}
          />
        </div>
      </div>
      <section className="max-w-3xl">
        <SpecTable
          caption={t('product.specs')}
          rows={specRows(product, t, route)}
          emptyLabel={t('product.specsEmpty')}
        />
      </section>
    </article>
  )
}
