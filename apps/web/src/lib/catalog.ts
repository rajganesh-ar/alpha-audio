import { unstable_cache } from 'next/cache'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import {
  STOREFRONT_TAGS,
  loadRightsWindows,
  type LocaleCode,
  type RightsWindow,
} from '@alpha/payload'
import type { Brand, Category, Home, Product } from '@/payload-types'

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

/**
 * Published products for a listing: in the given categories, or every product when `null`.
 * The caller keeps those sold in the market; catalogues are hundreds of products, not millions.
 */
export const getListingProducts = (
  categoryIds: readonly number[] | null,
  locale: LocaleCode,
): Promise<Product[]> =>
  unstable_cache(
    async () =>
      (
        await (
          await payload()
        ).find({
          collection: 'products',
          ...(categoryIds ? { where: { categories: { in: [...categoryIds] } } } : {}),
          limit: 1000,
          depth: 1,
          sort: '-createdAt',
          locale,
          ...read,
        })
      ).docs,
    ['listing-products', categoryIds ? categoryIds.join(',') : 'all', locale],
    { tags: [STOREFRONT_TAGS.catalog], revalidate: REVALIDATE_SECONDS },
  )()

/** A category and every category below it. */
export function descendantIds(categories: readonly Category[], id: number): number[] {
  const parentOf = (c: Category) =>
    typeof c.parent === 'object' ? (c.parent?.id ?? null) : (c.parent ?? null)
  const ids = [id]
  for (let i = 0; i < ids.length; i++) {
    for (const c of categories) if (parentOf(c) === ids[i] && !ids.includes(c.id)) ids.push(c.id)
  }
  return ids
}

export const parentId = (c: Category): number | null =>
  typeof c.parent === 'object' ? (c.parent?.id ?? null) : (c.parent ?? null)

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

/** Brand rights windows (public projection of BrandAgreements), cached like the catalogue. */
export const getRightsWindows = (): Promise<RightsWindow[]> =>
  unstable_cache(async () => loadRightsWindows(await payload()), ['rights-windows'], {
    tags: [STOREFRONT_TAGS.catalog],
    revalidate: REVALIDATE_SECONDS,
  })()

/** Every published brand, by name. */
export const getBrands = (locale: LocaleCode): Promise<Brand[]> =>
  unstable_cache(
    async () =>
      (
        await (
          await payload()
        ).find({ collection: 'brands', limit: 500, depth: 1, sort: 'name', locale, ...read })
      ).docs,
    ['brands', locale],
    { tags: [STOREFRONT_TAGS.catalog], revalidate: REVALIDATE_SECONDS },
  )()
