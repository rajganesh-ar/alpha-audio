import { LISTING_PAGE_SIZE, LISTING_SORTS, type ListingQuery } from '@alpha/core'
import type { MarketRoute } from '@alpha/payload'
import {
  Breadcrumb,
  Button,
  EmptyState,
  FacetRail,
  Grid,
  GridItem,
  Pagination,
  SortMenu,
  getDictionary,
  translator,
} from '@alpha/ui'
import { ProductCardView } from '@/components/ProductCardView'
import { activeFilters, facetGroups, isFiltered, listingHref } from '@/lib/listing'
import { productPath } from '@/lib/productView'
import { jsonLd, localizedPath, siteUrl } from '@/lib/seo'
import { loadListing } from './listingRoute'

const FORM_ID = 'listing-filters'

/** Category links styled as pills (44 px target, visible focus, token colours). */
const PILL =
  'inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-base text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

/**
 * Category listing and shop index (docs/tasks/0007). Rendered as ISR without a query, and as
 * the dynamic twin (`shop-results`) with one; the markup is the same.
 */
export async function ListingPage({
  route,
  path,
  query,
}: {
  route: MarketRoute
  path: readonly string[]
  query: ListingQuery
}) {
  const t = translator(getDictionary(route.locale))
  const { category, trail, result, stock, base, children, suggestions } = await loadListing(
    route,
    path,
    query,
  )
  const { market } = route
  const title = category?.title ?? t('listing.allProducts')
  const home = localizedPath(market.code, route.locale)
  const origin = siteUrl()
  const filtered = isFiltered(query)
  const pageHref = (page: number) => listingHref(base, { ...query, page }, market)

  const crumbs = [
    { label: t('ui.home'), href: home },
    ...(category
      ? [
          { label: t('listing.shop'), href: localizedPath(market.code, route.locale, 'shop') },
          ...trail.slice(0, -1).map((c, i) => ({
            label: c.title,
            href: localizedPath(
              market.code,
              route.locale,
              ['shop', ...trail.slice(0, i + 1).map((x) => x.slug)].join('/'),
            ),
          })),
        ]
      : []),
    { label: category ? title : t('listing.shop') },
  ]

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: result.total,
    itemListElement: result.items.map((item, i) => ({
      '@type': 'ListItem',
      position: (result.page - 1) * LISTING_PAGE_SIZE + i + 1,
      url: new URL(productPath(route, item.data.slug), origin).toString(),
      name: item.title,
    })),
  }

  return (
    <div className="flex flex-col gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(itemList) }} />
      {/* React 19 hoists these into <head>. Filters get no rel links: they are noindex. */}
      {!filtered && result.page > 1 ? <link rel="prev" href={pageHref(result.page - 1)} /> : null}
      {!filtered && result.page < result.pages ? (
        <link rel="next" href={pageHref(result.page + 1)} />
      ) : null}

      <Breadcrumb label={t('ui.breadcrumb')} items={crumbs} />
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
          {result.page > 1 ? t('listing.pageTitle', { title, page: result.page }) : title}
        </h1>
        {category?.summary ? (
          <p className="max-w-2xl text-lg text-ink-muted">{category.summary}</p>
        ) : null}
        {children.length ? (
          // One scrolling row on small screens, so a late web font cannot rewrap it and shift the page.
          <nav aria-label={t('listing.categories')}>
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] lg:mx-0 lg:flex-wrap lg:px-0">
              {children.map(({ category: c, href }) => (
                <li key={c.id} className="shrink-0">
                  <a href={href} className={PILL}>
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <FacetRail
            formId={FORM_ID}
            action={base}
            title={t('listing.filters')}
            toggleLabel={
              activeFilters(query)
                ? t('listing.filtersToggle', { count: activeFilters(query) })
                : t('listing.filters')
            }
            groups={facetGroups(result.facets, query, route, t)}
            applyLabel={t('listing.apply')}
            clearLabel={t('listing.clear')}
            clearHref={filtered ? base : undefined}
          />
        </aside>
        <section className="flex flex-col gap-6 lg:col-span-9" aria-labelledby="listing-results">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p id="listing-results" className="text-base text-ink-muted" role="status">
              {result.total === 1
                ? t('listing.resultsOne')
                : t('listing.results', { count: result.total })}
            </p>
            <SortMenu
              label={t('listing.sort')}
              name="sort"
              form={FORM_ID}
              value={query.sort}
              submitLabel={t('listing.sortApply')}
              options={LISTING_SORTS.map((value) => ({
                value,
                label: t(`listing.sorts.${value}`),
              }))}
            />
          </div>
          {result.items.length ? (
            <Grid as="ul">
              {result.items.map((item, index) => (
                <GridItem key={item.id} as="li" span={4} spanDesktop={4}>
                  <ProductCardView
                    product={item.data}
                    route={route}
                    stock={stock.get(item.data.sku)}
                    headingLevel={2}
                    image={index === 0 ? 'lcp' : index < 3 ? 'eager' : 'lazy'}
                  />
                </GridItem>
              ))}
            </Grid>
          ) : (
            <EmptyState
              title={t('listing.emptyTitle')}
              body={t('listing.emptyBody')}
              icon="search"
              action={
                filtered ? (
                  <Button href={base} variant="secondary">
                    {t('listing.clear')}
                  </Button>
                ) : undefined
              }
              note={
                suggestions.length ? (
                  <ul className="flex flex-wrap justify-center gap-2">
                    {suggestions.map(({ category: c, href }) => (
                      <li key={c.id}>
                        <a href={href} className={PILL}>
                          {c.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : undefined
              }
              align="center"
            />
          )}
          <Pagination
            label={t('listing.pagination')}
            current={result.page}
            pages={result.pages}
            hrefFor={pageHref}
            previousLabel={t('listing.previous')}
            nextLabel={t('listing.next')}
            pageLabel={t('listing.page')}
          />
        </section>
      </div>
    </div>
  )
}
