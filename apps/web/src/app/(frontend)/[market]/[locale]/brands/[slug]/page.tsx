import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  Breadcrumb,
  Button,
  Grid,
  GridItem,
  Hero,
  Section,
  getDictionary,
  translator,
} from '@alpha/ui'
import { ProductCardView } from '@/components/ProductCardView'
import { brandMarkets, brandPage } from '@/lib/brands'
import { getMarketRoute, getMarkets, requireMarketRoute } from '@/lib/markets'
import { brandJsonLd, imageOf } from '@/lib/productView'
import { alternatesFor, jsonLd, localizedPath, siteUrl } from '@/lib/seo'
import { stockPromises } from '@/lib/stock'

type Params = Promise<{ market: string; locale: string; slug: string }>

export const revalidate = 300
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale, slug } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  const page = await brandPage(route, slug)
  if (!page) return {}
  const markets = await getMarkets()
  const live = await brandMarkets(page.brand.id, markets)
  return {
    title: page.brand.name,
    description: page.brand.story ?? undefined,
    alternates: alternatesFor(markets, route, `/brands/${page.brand.slug}`, (m) =>
      live.has(m.code),
    ),
  }
}

/** Brand page (spec: Brand page). A brand without live rights in the market is a 404. */
export default async function BrandPage({ params }: { params: Params }) {
  const route = await requireMarketRoute(params)
  const { slug } = await params
  const page = await brandPage(route, slug)
  if (!page) notFound()
  const { brand, families } = page
  const t = translator(getDictionary(route.locale))
  const at = (path: string) => localizedPath(route.market.code, route.locale, path)
  const all = families.flatMap((f) => f.products)
  const stock = all.length
    ? await stockPromises(
        all.map((p) => p.sku),
        route.market.code,
      )
    : new Map()
  const origin = siteUrl()
  const logo = imageOf(brand.logo)
  const shopAll = `${at('/shop')}?brand=${brand.slug}`

  const brandLd = brandJsonLd({
    name: brand.name,
    url: new URL(at(`/brands/${brand.slug}`), origin).toString(),
    description: brand.story,
    logo: logo ? new URL(logo.url, origin).toString() : null,
  })

  let index = 0
  return (
    <div className="flex flex-col gap-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(brandLd) }} />
      <Breadcrumb
        label={t('ui.breadcrumb')}
        items={[
          { label: t('ui.home'), href: at('/') },
          { label: t('brands.title'), href: at('/brands') },
          { label: brand.name },
        ]}
      />
      <div className="-mx-4">
        <Hero
          headline={brand.name}
          lede={brand.story ?? undefined}
          cta={
            all.length
              ? { label: t('brands.shopAll', { brand: brand.name }), href: shopAll }
              : undefined
          }
        />
      </div>
      {families.map((family) => (
        <Section
          key={family.category?.id ?? 'other'}
          title={family.category?.title ?? t('listing.allProducts')}
        >
          <Grid as="ul">
            {family.products.map((product) => {
              const position = index++
              return (
                <GridItem key={product.id} as="li" span={4} spanDesktop={3}>
                  <ProductCardView
                    product={product}
                    route={route}
                    stock={stock.get(product.sku)}
                    image={position === 0 ? 'lcp' : position < 4 ? 'eager' : 'lazy'}
                  />
                </GridItem>
              )
            })}
          </Grid>
        </Section>
      ))}
      {all.length ? (
        <div>
          <Button href={shopAll} variant="secondary" icon="arrow-forward" iconPosition="end">
            {t('brands.shopAll', { brand: brand.name })}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
