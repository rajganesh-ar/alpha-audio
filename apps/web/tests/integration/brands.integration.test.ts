import { describe, expect, it, vi } from 'vitest'
import { EMPTY_LISTING_QUERY } from '@alpha/core'
import {
  MARKETS_SEED,
  loadRightsWindows,
  resolveMarketRoute,
  type MarketRoute,
} from '@alpha/payload'
import { staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'

// Outside Next.js there is no incremental cache; the loaders run uncached here.
vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

const payload = usePayload()
const route = resolveMarketRoute(MARKETS_SEED, 'ae', 'en') as MarketRoute

type Refusal = Error & { status?: number }
async function refusal(action: Promise<unknown>): Promise<Refusal> {
  try {
    await action
  } catch (error) {
    return error as Refusal
  }
  throw new Error('expected the operation to be refused')
}

const as = async () =>
  ({
    user: await staff(payload()),
    overrideAccess: false,
    context: { disableRevalidate: true },
  }) as const

async function brandWithProduct(slug: string) {
  const ctx = await as()
  const brand = await payload().create({
    collection: 'brands',
    data: { name: slug, slug, priceDisplay: 'show', arabicReview: 'draft', _status: 'published' },
    ...ctx,
  })
  const product = await payload().create({
    collection: 'products',
    data: {
      title: `${slug} model`,
      slug: `${slug}-model`,
      sku: `${slug.toUpperCase()}-MODEL`,
      brand: brand.id,
      markets: [{ market: 'ae', published: true, rrpInclVat: 500_000 }],
      lifecycle: 'active',
      arabicReview: 'draft',
      _status: 'published',
    },
    ...ctx,
  })
  return { brand, product }
}

const agreement = async (brand: number, patch: Record<string, unknown> = {}) =>
  payload().create({
    collection: 'brand-agreements',
    data: {
      brand,
      market: 'ae',
      role: 'distributor',
      exclusive: false,
      leadRouting: 'alpha',
      validFrom: '2024-01-01T00:00:00.000Z',
      ...patch,
    },
    ...(await as()),
  })

describe('BrandAgreements access and validation', () => {
  it('is staff-only to read; nobody deletes', async () => {
    const { brand } = await brandWithProduct('acc-brand')
    const doc = await agreement(brand.id)
    expect(
      (await refusal(payload().find({ collection: 'brand-agreements', overrideAccess: false })))
        .status,
    ).toBe(403)
    const outsider = {
      id: 1,
      collection: 'customers',
      email: 'x@example.com',
    } as unknown as Awaited<ReturnType<typeof staff>>
    expect(
      (
        await refusal(
          payload().findByID({
            collection: 'brand-agreements',
            id: doc.id,
            user: outsider,
            overrideAccess: false,
          }),
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await refusal(
          payload().delete({ collection: 'brand-agreements', id: doc.id, ...(await as()) }),
        )
      ).status,
    ).toBe(403)
  })

  it('refuses overlapping windows and an end before the start, and allows back-to-back agreements', async () => {
    const { brand } = await brandWithProduct('win-brand')
    const first = await agreement(brand.id, { validTo: '2026-06-30T00:00:00.000Z' })
    expect(
      (await refusal(agreement(brand.id, { validFrom: '2026-06-01T00:00:00.000Z' }))).message,
    ).toMatch(/covers part of this period/)
    expect(
      (
        await refusal(
          agreement(brand.id, {
            market: 'sa',
            validFrom: '2026-05-01T00:00:00.000Z',
            validTo: '2026-04-01T00:00:00.000Z',
          }),
        )
      ).message,
    ).toMatch(/after valid from/)
    await agreement(brand.id, { validFrom: '2026-06-30T00:00:00.000Z', role: 'retailer' })
    // Editing an agreement does not collide with itself.
    await payload().update({
      collection: 'brand-agreements',
      id: first.id,
      data: { notes: 'Renewal under negotiation' },
      ...(await as()),
    })
    // Ending the second one earlier than it starts is refused on update too.
    expect(
      (
        await refusal(
          agreement(brand.id, {
            market: 'sa',
            validFrom: '2026-01-01T00:00:00.000Z',
            validTo: '2026-01-01T00:00:00.000Z',
          }),
        )
      ).status,
    ).toBe(400)
  })
})

describe('storefront follows brand rights', () => {
  it('exposes only the selling windows, and hides products of brands without live rights', async () => {
    const live = await brandWithProduct('live-brand')
    const ended = await brandWithProduct('ended-brand')
    const none = await brandWithProduct('none-brand')
    const blocked = await brandWithProduct('blocked-brand')
    const unsigned = await brandWithProduct('unsigned-brand')
    await agreement(live.brand.id, { exclusive: true })
    await agreement(ended.brand.id, { validTo: '2026-01-01T00:00:00.000Z' })
    await agreement(none.brand.id, { role: 'none' })
    await agreement(blocked.brand.id, { complianceFlags: ['origin-restriction'] })

    const windows = await loadRightsWindows(payload())
    const mine = windows.filter((w) =>
      [live, ended, none, blocked, unsigned].some((b) => String(b.brand.id) === w.brand),
    )
    expect(mine.map((w) => w.brand).sort()).toEqual(
      [String(live.brand.id), String(ended.brand.id)].sort(),
    )
    for (const w of mine) expect(Object.keys(w).sort()).toEqual(['brand', 'from', 'market', 'to'])

    // Loaded here: these modules read the Payload config, which needs the env bootPayload sets.
    const { getSaleRule } = await import('@/lib/rights')
    const { loadListing } = await import('@/components/listing/listingRoute')
    const { brandIndex, brandPage } = await import('@/lib/brands')
    const onSale = await getSaleRule()
    expect(onSale(live.product, 'ae')).toBe(true)
    for (const b of [ended, none, blocked, unsigned]) expect(onSale(b.product, 'ae')).toBe(false)

    const listing = await loadListing(route, [], EMPTY_LISTING_QUERY)
    const skus = listing.result.items.map((i) => i.data.sku)
    expect(skus).toContain('LIVE-BRAND-MODEL')
    for (const sku of [
      'ENDED-BRAND-MODEL',
      'NONE-BRAND-MODEL',
      'BLOCKED-BRAND-MODEL',
      'UNSIGNED-BRAND-MODEL',
    ])
      expect(skus).not.toContain(sku)
    expect(listing.result.facets.brands.map((b) => b.value)).not.toContain('ended-brand')

    const index = (await brandIndex(route)).flatMap((g) => g.brands.map((b) => b.brand.slug))
    expect(index).toContain('live-brand')
    for (const slug of ['ended-brand', 'none-brand', 'blocked-brand', 'unsigned-brand'])
      expect(index).not.toContain(slug)
    const page = await brandPage(route, 'live-brand')
    expect(page?.total).toBe(1)
    expect(await brandPage(route, 'ended-brand')).toBeNull()
  })
})
