import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { STOREFRONT_TAGS, type LocaleCode } from '@alpha/payload'
import type { Page } from '@/payload-types'

/**
 * Storefront reads of editorial pages (docs/tasks/0011): anonymous Local API calls with
 * `overrideAccess: false` (published only), cached under the `content` tag that the Pages hook
 * expires on publish, and for at most five minutes.
 */
const REVALIDATE_SECONDS = 300
const read = { overrideAccess: false, draft: false, fallbackLocale: 'en' } as const

export const getLegalPage = (slug: string, locale: LocaleCode): Promise<Page | null> =>
  unstable_cache(
    async () => {
      const { docs } = await (
        await getPayload({ config })
      ).find({
        collection: 'pages',
        where: { and: [{ kind: { equals: 'legal' } }, { slug: { equals: slug } }] },
        limit: 1,
        depth: 0,
        locale,
        ...read,
      })
      return docs[0] ?? null
    },
    ['legal-page', slug, locale],
    { tags: [STOREFRONT_TAGS.content], revalidate: REVALIDATE_SECONDS },
  )()

/** Legal pages published in a market, for the footer and the sitemap (title order). */
export const getLegalPages = (market: string, locale: LocaleCode): Promise<Page[]> =>
  unstable_cache(
    async () =>
      (
        await (
          await getPayload({ config })
        ).find({
          collection: 'pages',
          where: { and: [{ kind: { equals: 'legal' } }, { markets: { in: [market] } }] },
          limit: 50,
          depth: 0,
          sort: 'slug',
          locale,
          ...read,
        })
      ).docs,
    ['legal-pages', market, locale],
    { tags: [STOREFRONT_TAGS.content], revalidate: REVALIDATE_SECONDS },
  )()

export const publishedInMarket = (page: Pick<Page, 'markets'>, market: string): boolean =>
  (page.markets ?? []).includes(market as Page['markets'][number])
