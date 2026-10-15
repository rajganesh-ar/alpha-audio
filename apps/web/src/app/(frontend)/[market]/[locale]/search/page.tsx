import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  Button,
  EmptyState,
  Grid,
  GridItem,
  Input,
  Pagination,
  getDictionary,
  translator,
} from '@alpha/ui'
import { ProductCardView } from '@/components/ProductCardView'
import { getCategories, parentId } from '@/lib/catalog'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
import { getSaleRule } from '@/lib/rights'
import { searchCatalogue } from '@/lib/search'
import { localizedPath } from '@/lib/seo'
import { stockPromises } from '@/lib/stock'

// Per query and never cached; `noindex` (robots.txt disallows /search too).
export const dynamic = 'force-dynamic'

type Params = Promise<{ market: string; locale: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  return {
    title: translator(getDictionary(route.locale))('search.metaTitle'),
    robots: { index: false, follow: true },
  }
}

const PILL =
  'inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-base text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

/**
 * Catalogue search (docs/tasks/0011): a GET form, so it works without JavaScript; results in
 * rank order with price incl. VAT and the live stock line; categories when nothing matches.
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const route = await requireMarketRoute(params)
  const search = await searchParams
  const t = translator(getDictionary(route.locale))
  const q = typeof search['q'] === 'string' ? search['q'] : ''
  const pageParam = Number(typeof search['page'] === 'string' ? search['page'] : '1')
  const result = await searchCatalogue(
    await getPayload({ config }),
    route,
    q,
    pageParam,
    await getSaleRule(),
  )
  const stock = await stockPromises(
    result.products.map((p) => p.sku),
    route.market.code,
  )
  const base = localizedPath(route.market.code, route.locale, '/search')
  const href = (page: number) =>
    `${base}?${new URLSearchParams({ q: result.query.text, ...(page > 1 ? { page: String(page) } : {}) }).toString()}`
  const categories = (await getCategories(route.locale)).filter((c) => parentId(c) === null)
  const categoryLinks = (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {categories.map((c) => (
        <li key={c.id}>
          <a
            href={localizedPath(route.market.code, route.locale, `/shop/${c.slug}`)}
            className={PILL}
          >
            {c.title}
          </a>
        </li>
      ))}
    </ul>
  )
  const searched = result.query.tsquery !== null

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
          {t('search.title')}
        </h1>
        <form
          method="get"
          action={base}
          role="search"
          className="flex max-w-2xl flex-wrap items-end gap-3"
        >
          <div className="min-w-0 flex-1">
            <Input
              label={t('search.label')}
              name="q"
              type="search"
              defaultValue={result.query.text}
              placeholder={t('search.placeholder')}
              maxLength={100}
            />
          </div>
          <Button type="submit" icon="search">
            {t('search.submit')}
          </Button>
        </form>
        {searched && result.total > 0 ? (
          <p role="status" className="text-base text-ink-muted">
            {result.total === 1
              ? t('search.resultsOne', { query: result.query.text })
              : t('search.results', { count: result.total, query: result.query.text })}
          </p>
        ) : null}
      </div>

      {!searched ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-ink">{t('search.popular')}</h2>
          {categoryLinks}
        </section>
      ) : result.total === 0 ? (
        <EmptyState
          title={t('search.noneTitle', { query: result.query.text })}
          body={t('search.noneBody')}
          icon="search"
          note={
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-ink">{t('search.suggestions')}</h2>
              {categoryLinks}
            </div>
          }
        />
      ) : (
        <>
          <Grid as="ul">
            {result.products.map((product, index) => (
              <GridItem key={product.id} as="li" span={4} spanDesktop={4}>
                <ProductCardView
                  product={product}
                  route={route}
                  stock={stock.get(product.sku)}
                  headingLevel={2}
                  image={index === 0 ? 'lcp' : index < 3 ? 'eager' : 'lazy'}
                />
              </GridItem>
            ))}
          </Grid>
          {result.pages > 1 ? (
            <Pagination
              label={t('listing.pagination')}
              current={result.page}
              pages={result.pages}
              hrefFor={href}
              previousLabel={t('listing.previous')}
              nextLabel={t('listing.next')}
              pageLabel={t('listing.page')}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
