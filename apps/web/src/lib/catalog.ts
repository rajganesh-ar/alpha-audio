import { unstable_cache } from 'next/cache'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { STOREFRONT_TAGS, type LocaleCode } from '@alpha/payload'
import type { Category, Home, Product } from '@/payload-types'

/**
 * Storefront reads of the catalogue and the Home global. Anonymous Local API calls with
 * `overrideAccess: false`, so only published documents come back and staff-only fields (cost)
 * are stripped before anything is cached or rendered. Results are cached under the tags the
 * Payload hooks expire on publish (`revalidateStorefront`), and for at most five minutes.
 */

const REVALIDATE_SECONDS = 300
const read = { overrideAccess: false, draft: false, fallbackLocale: 'en' } as const

const payload = (): Promise<Payload> => getPayload({ config })

export const getHome = (locale: LocaleCode): Promise<Home> =>
  unstable_cache(
    async () => (await payload()).findGlobal({ slug: 'home', locale, depth: 2, ...read }),
    ['home', locale],
    { tags: [STOREFRONT_TAGS.home, STOREFRONT_TAGS.catalog], revalidate: REVALIDATE_SECONDS },
  )()

export const getProduct = (slug: string, locale: LocaleCode): Promise<Product | null> =>
  unstable_cache(
    async () => {
      const { docs } = await (
        await payload()
      ).find({
        collection: 'products',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 2,
        locale,
        ...read,
      })
      return docs[0] ?? null
    },
    ['product', slug, locale],
    { tags: [STOREFRONT_TAGS.catalog], revalidate: REVALIDATE_SECONDS },
  )()

export const getCategories = (locale: LocaleCode): Promise<Category[]> =>
  unstable_cache(
    async () =>
      (
        await (
          await payload()
        ).find({ collection: 'categories', limit: 500, depth: 0, sort: 'order', locale, ...read })
      ).docs,
    ['categories', locale],
    { tags: [STOREFRONT_TAGS.catalog], revalidate: REVALIDATE_SECONDS },
  )()

/** Published products in a category (and its children), newest first; the caller filters by market. */
export const getCategoryProducts = (
  categoryIds: readonly number[],
  locale: LocaleCode,
): Promise<Product[]> =>
  unstable_cache(
    async () =>
      (
        await (
          await payload()
        ).find({
          collection: 'products',
          where: { categories: { in: [...categoryIds] } },
          limit: 48,
          depth: 1,
          sort: '-createdAt',
          locale,
          ...read,
        })
      ).docs,
    ['category-products', categoryIds.join(','), locale],
    { tags: [STOREFRONT_TAGS.catalog], revalidate: REVALIDATE_SECONDS },
  )()

/** Root-first chain of a category and its parents, for breadcrumbs. */
export function categoryTrail(
  categories: readonly Category[],
  id: number | null | undefined,
): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const trail: Category[] = []
  const seen = new Set<number>()
  let current = id === null || id === undefined ? undefined : byId.get(id)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    trail.unshift(current)
    const parent = current.parent
    current =
      typeof parent === 'number' ? byId.get(parent) : parent ? byId.get(parent.id) : undefined
  }
  return trail
}
