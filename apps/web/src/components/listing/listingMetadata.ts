import type { Metadata } from 'next'
import type { ListingQuery } from '@alpha/core'
import type { MarketRoute } from '@alpha/payload'
import { getDictionary, translator } from '@alpha/ui'
import { getCategories } from '@/lib/catalog'
import { isFiltered, listingSearch } from '@/lib/listing'
import { getMarkets } from '@/lib/markets'
import { alternatesFor } from '@/lib/seo'

/**
 * Listing SEO (spec: routing rules). A filtered or re-sorted view is `noindex, follow` and
 * canonical to the unfiltered listing; a plain page N is indexable and canonical to itself.
 */
export async function listingMetadata(
  route: MarketRoute,
  path: readonly string[],
  query: ListingQuery,
): Promise<Metadata> {
  const t = translator(getDictionary(route.locale))
  const slug = path.at(-1)
  const category = slug
    ? (await getCategories(route.locale)).find((c) => c.slug === slug)
    : undefined
  if (slug && !category) return {}
  const title = category?.title ?? t('listing.allProducts')
  const shopPath = ['shop', ...path].join('/')
  const alternates = alternatesFor(await getMarkets(), route, shopPath)
  const description = category?.summary || t('listing.description')
  if (isFiltered(query)) {
    return {
      title,
      description,
      robots: { index: false, follow: true },
      alternates: { canonical: alternates.canonical ?? null },
    }
  }
  if (query.page > 1) {
    const canonical = `${String(alternates.canonical)}${listingSearch({ ...query }, route.market)}`
    return {
      title: t('listing.pageTitle', { title, page: query.page }),
      description,
      alternates: { canonical },
    }
  }
  return { title, description, alternates }
}
