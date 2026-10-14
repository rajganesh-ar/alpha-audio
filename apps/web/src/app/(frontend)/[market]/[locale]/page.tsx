import type { Metadata } from 'next'
import Image from 'next/image'
import { publishedIn } from '@alpha/core'
import type { EntryTool } from '@alpha/payload'
import {
  Card,
  EntryCard,
  Grid,
  GridItem,
  Hero,
  Section,
  getDictionary,
  translator,
  type IconName,
} from '@alpha/ui'
import { ProductCardView } from '@/components/ProductCardView'
import { getCategories, getHome } from '@/lib/catalog'
import { getMarketRoute, getMarkets, requireMarketRoute } from '@/lib/markets'
import { imageOf } from '@/lib/productView'
import { alternatesFor, jsonLd, localizedPath, siteUrl } from '@/lib/seo'
import { stockPromises } from '@/lib/stock'
import type { Category, Product } from '@/payload-types'

type Params = Promise<{ market: string; locale: string }>

export const revalidate = 300

const TOOL_ICON: Record<EntryTool, IconName> = {
  advisor: 'sparkles',
  'room-lab': 'ruler',
  builder: 'layers',
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  const t = translator(getDictionary(route.locale))
  const home = await getHome(route.locale)
  return {
    title: {
      absolute: home.seo?.title || t('home.title', { market: route.market.name[route.locale] }),
    },
    description: home.seo?.description || home.hero.lede || t('home.lede'),
    alternates: alternatesFor(await getMarkets(), route, '/'),
  }
}

/** Market home (spec: Page specifications → Home). ISR from the Home global. */
export default async function MarketHome({ params }: { params: Params }) {
  const route = await requireMarketRoute(params)
  const t = translator(getDictionary(route.locale))
  const home = await getHome(route.locale)
  const at = (path: string) => localizedPath(route.market.code, route.locale, path)
  const origin = siteUrl()

  const featured = (home.featured ?? []).filter(
    (p): p is Product =>
      typeof p === 'object' && p !== null && publishedIn(p.markets, route.market.code),
  )
  const chosen = (home.topCategories ?? []).filter(
    (c): c is Category => typeof c === 'object' && c !== null,
  )
  const categories = featured.length
    ? []
    : chosen.length
      ? chosen
      : (await getCategories(route.locale)).filter((c) => !c.parent).slice(0, 6)
  const stock = featured.length
    ? await stockPromises(
        featured.map((p) => p.sku),
        route.market.code,
      )
    : new Map()
  const poster = imageOf(home.hero.poster)

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: t('shell.brand'),
    url: new URL('/', origin).toString(),
  }
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: t('shell.brand'),
    url: new URL(at('/'), origin).toString(),
    inLanguage: route.languageTag,
  }

  return (
    <div className="flex flex-col gap-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd([organization, website]) }}
      />
      <div className="-mx-4 -mt-8">
        <Hero
          eyebrow={home.hero.eyebrow ?? undefined}
          headline={home.hero.headline}
          lede={home.hero.lede ?? undefined}
          cta={
            home.hero.ctaLabel && home.hero.ctaHref
              ? { label: home.hero.ctaLabel, href: at(home.hero.ctaHref) }
              : undefined
          }
          media={
            poster ? (
              <Image
                src={poster.url}
                alt={poster.alt}
                fill
                priority
                fetchPriority="high"
                sizes="100vw"
              />
            ) : undefined
          }
        />
      </div>

      {home.entryCards?.length ? (
        <Grid as="ul">
          {home.entryCards.map((card) => (
            <GridItem key={card.id ?? card.tool} as="li" span={4} spanDesktop={4}>
              <EntryCard
                icon={TOOL_ICON[card.tool]}
                title={card.title}
                body={card.body ?? undefined}
                href={at(`/design/${card.tool}`)}
                ctaLabel={card.ctaLabel ?? undefined}
                headingLevel={2}
              />
            </GridItem>
          ))}
        </Grid>
      ) : null}

      {featured.length ? (
        <Section title={home.featuredTitle || t('home.featured')}>
          <Grid as="ul">
            {featured.map((product) => (
              <GridItem key={product.id} as="li" span={4} spanDesktop={3}>
                <ProductCardView product={product} route={route} stock={stock.get(product.sku)} />
              </GridItem>
            ))}
          </Grid>
        </Section>
      ) : categories.length ? (
        <Section title={home.categoriesTitle || t('home.categories')}>
          <Grid as="ul">
            {categories.map((category) => (
              <GridItem key={category.id} as="li" span={4} spanDesktop={4}>
                <Card title={category.title} href={at(`/shop/${category.slug}`)} headingLevel={3}>
                  {category.summary ?? undefined}
                </Card>
              </GridItem>
            ))}
          </Grid>
        </Section>
      ) : null}
    </div>
  )
}
