import type { Metadata } from 'next'
import Image from 'next/image'
import {
  BrandTile,
  Breadcrumb,
  EmptyState,
  Grid,
  GridItem,
  Section,
  getDictionary,
  translator,
} from '@alpha/ui'
import { brandIndex } from '@/lib/brands'
import { getMarketRoute, getMarkets, requireMarketRoute } from '@/lib/markets'
import { imageOf } from '@/lib/productView'
import { alternatesFor, localizedPath } from '@/lib/seo'

type Params = Promise<{ market: string; locale: string }>

export const revalidate = 300

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  const t = translator(getDictionary(route.locale))
  return {
    title: t('brands.title'),
    description: t('brands.description', { market: route.market.name[route.locale] }),
    alternates: alternatesFor(await getMarkets(), route, '/brands'),
  }
}

/** Brand index (spec: Brand index): brands with a live agreement in the market, by category. */
export default async function BrandIndex({ params }: { params: Params }) {
  const route = await requireMarketRoute(params)
  const t = translator(getDictionary(route.locale))
  const groups = await brandIndex(route)
  const at = (path: string) => localizedPath(route.market.code, route.locale, path)
  return (
    <div className="flex flex-col gap-10">
      <Breadcrumb
        label={t('ui.breadcrumb')}
        items={[{ label: t('ui.home'), href: at('/') }, { label: t('brands.title') }]}
      />
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
          {t('brands.title')}
        </h1>
        <p className="max-w-2xl text-lg text-ink-muted">
          {t('brands.lede', { market: route.market.name[route.locale] })}
        </p>
      </header>
      {groups.length === 0 ? <EmptyState title={t('brands.empty')} icon="info" /> : null}
      {groups.map((group) => (
        <Section
          key={group.category?.id ?? 'more'}
          title={group.category?.title ?? t('brands.more')}
        >
          <Grid as="ul">
            {group.brands.map(({ brand, count }) => {
              const logo = imageOf(brand.logo)
              return (
                <GridItem key={brand.id} as="li" span={2} spanDesktop={3}>
                  <BrandTile
                    name={brand.name}
                    href={at(`/brands/${brand.slug}`)}
                    logo={
                      logo ? (
                        <Image
                          src={logo.url}
                          alt={logo.alt}
                          fill
                          sizes="(min-width: 64rem) 20vw, 45vw"
                        />
                      ) : undefined
                    }
                    meta={
                      count === 0
                        ? t('brands.noProducts')
                        : count === 1
                          ? t('brands.productsOne')
                          : t('brands.products', { count })
                    }
                  />
                </GridItem>
              )
            })}
          </Grid>
        </Section>
      ))}
    </div>
  )
}
