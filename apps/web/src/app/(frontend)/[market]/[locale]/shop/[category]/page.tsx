import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { publishedIn } from '@alpha/core'
import { Breadcrumb, EmptyState, Grid, GridItem, getDictionary, translator } from '@alpha/ui'
import { ProductCardView } from '@/components/ProductCardView'
import { categoryTrail, getCategories, getCategoryProducts } from '@/lib/catalog'
import { getMarketRoute, getMarkets, requireMarketRoute } from '@/lib/markets'
import { alternatesFor, localizedPath } from '@/lib/seo'
import { stockPromises } from '@/lib/stock'

type Params = Promise<{ market: string; locale: string; category: string }>

export const revalidate = 300
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale, category } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  const found = (await getCategories(route.locale)).find((c) => c.slug === category)
  if (!found) return {}
  return {
    title: found.title,
    description: found.summary ?? undefined,
    alternates: alternatesFor(await getMarkets(), route, `/shop/${found.slug}`),
  }
}

/**
 * Interim category page: the category's products published in the market, so the home page's
 * category cards and the product breadcrumbs lead somewhere. Facets, sort and pagination come
 * with the category listing task.
 */
export default async function CategoryPage({ params }: { params: Params }) {
  const route = await requireMarketRoute(params)
  const { category: slug } = await params
  const categories = await getCategories(route.locale)
  const category = categories.find((c) => c.slug === slug)
  if (!category) notFound()
  const t = translator(getDictionary(route.locale))
  const ids = [
    category.id,
    ...categories
      .filter((c) => (typeof c.parent === 'object' ? c.parent?.id : c.parent) === category.id)
      .map((c) => c.id),
  ]
  const products = (await getCategoryProducts(ids, route.locale)).filter((p) =>
    publishedIn(p.markets, route.market.code),
  )
  const stock = products.length
    ? await stockPromises(
        products.map((p) => p.sku),
        route.market.code,
      )
    : new Map()
  const at = (path: string) => localizedPath(route.market.code, route.locale, path)

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumb
        label={t('ui.breadcrumb')}
        items={[
          { label: t('ui.home'), href: at('/') },
          ...categoryTrail(categories, category.id)
            .slice(0, -1)
            .map((c) => ({ label: c.title, href: at(`/shop/${c.slug}`) })),
          { label: category.title },
        ]}
      />
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
          {category.title}
        </h1>
        {category.summary ? (
          <p className="max-w-2xl text-lg text-ink-muted">{category.summary}</p>
        ) : null}
      </header>
      {products.length ? (
        <Grid as="ul">
          {products.map((product) => (
            <GridItem key={product.id} as="li" span={4} spanDesktop={3}>
              <ProductCardView product={product} route={route} stock={stock.get(product.sku)} />
            </GridItem>
          ))}
        </Grid>
      ) : (
        <EmptyState title={t('catalog.categoryEmpty')} icon="info" />
      )}
    </div>
  )
}
