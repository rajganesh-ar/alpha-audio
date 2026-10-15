import { describe, expect, it, vi } from 'vitest'
import { EMPTY_LISTING_QUERY, type ListingQuery } from '@alpha/core'
import { MARKETS_SEED, resolveMarketRoute, type MarketRoute } from '@alpha/payload'
import { staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'

// Outside Next.js there is no incremental cache; the loaders run uncached here.
vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

const payload = usePayload()
const route = resolveMarketRoute(MARKETS_SEED, 'ae', 'en') as MarketRoute
const q = (patch: Partial<ListingQuery> = {}): ListingQuery => ({
  ...EMPTY_LISTING_QUERY,
  ...patch,
})

async function notFoundOf(work: Promise<unknown>): Promise<boolean> {
  try {
    await work
    return false
  } catch (error) {
    return String((error as { digest?: string }).digest ?? '').includes('404')
  }
}

describe('category listing (loadListing against the database)', () => {
  it('resolves the category tree, filters by market, paginates and 404s bad paths', async () => {
    const user = await staff(payload())
    const as = { user, overrideAccess: false, context: { disableRevalidate: true } } as const
    const category = (slug: string, parent?: number) =>
      payload().create({
        collection: 'categories',
        data: {
          title: slug,
          slug,
          arabicReview: 'draft',
          _status: 'published',
          ...(parent ? { parent } : {}),
        },
        ...as,
      })
    const top = await category('list-top')
    const child = await category('list-child', top.id)
    const other = await category('list-other')
    const brand = (slug: string) =>
      payload().create({
        collection: 'brands',
        data: {
          name: slug,
          slug,
          priceDisplay: 'show',
          arabicReview: 'draft',
          _status: 'published',
        },
        ...as,
      })
    const [a, b] = await Promise.all([brand('list-brand-a'), brand('list-brand-b')])
    for (let i = 0; i < 26; i++) {
      await payload().create({
        collection: 'products',
        data: {
          title: `Listed ${String(i).padStart(2, '0')}`,
          slug: `list-product-${i}`,
          sku: `LIST-${i}`,
          brand: i % 2 ? a.id : b.id,
          categories: [i < 13 ? top.id : child.id],
          markets: [{ market: 'ae', published: true, rrpInclVat: (i + 1) * 100_000 }],
          lifecycle: 'active',
          arabicReview: 'draft',
          _status: 'published',
        },
        ...as,
      })
    }
    await payload().create({
      collection: 'products',
      data: {
        title: 'Saudi only',
        slug: 'list-saudi-only',
        sku: 'LIST-SA',
        brand: a.id,
        categories: [top.id],
        markets: [{ market: 'sa', published: true, rrpInclVat: 1 }],
        lifecycle: 'active',
        arabicReview: 'draft',
        _status: 'published',
      },
      ...as,
    })

    // Loaded here: the module reads the Payload config, which needs the env bootPayload sets.
    const { loadListing } = await import('@/components/listing/listingRoute')
    const listing = await loadListing(route, ['list-top'], q())
    expect([listing.result.total, listing.result.pages, listing.result.items.length]).toEqual([
      26, 2, 24,
    ])
    expect(listing.result.items.map((i) => i.title)).not.toContain('Saudi only')
    expect(listing.children.map((c) => c.href)).toEqual(['/ae/en/shop/list-top/list-child/'])
    expect(listing.result.facets.brands.map((x) => [x.value, x.count])).toEqual([
      ['list-brand-a', 13],
      ['list-brand-b', 13],
    ])

    const page2 = await loadListing(route, ['list-top'], q({ page: 2, sort: 'price-asc' }))
    expect(page2.result).toMatchObject({ total: 26, pages: 2, page: 2 })
    expect(page2.result.items.map((i) => i.title)).toEqual(['Listed 24', 'Listed 25'])
    const brandA = await loadListing(
      route,
      ['list-top'],
      q({ brands: ['list-brand-a'], sort: 'price-desc' }),
    )
    expect(brandA.result.total).toBe(13)
    expect(brandA.result.items[0]?.title).toBe('Listed 25')
    const sub = await loadListing(route, ['list-top', 'list-child'], q())
    expect(sub.result.total).toBe(13)
    expect(sub.trail.map((c) => c.slug)).toEqual(['list-top', 'list-child'])

    expect(await notFoundOf(loadListing(route, ['list-top'], q({ page: 3 })))).toBe(true)
    expect(await notFoundOf(loadListing(route, ['list-other', 'list-child'], q()))).toBe(true)
    expect(await notFoundOf(loadListing(route, ['nope'], q()))).toBe(true)
    expect(await notFoundOf(loadListing(route, ['list-top', 'list-child', 'x'], q()))).toBe(true)
    expect((await loadListing(route, ['list-other'], q())).result.total).toBe(0)
    expect(other.id).toBeGreaterThan(0)
  })
})
