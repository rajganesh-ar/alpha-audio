import { beforeAll, describe, expect, it, vi } from 'vitest'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { normaliseSearchText } from '@alpha/core'
import {
  MARKETS_SEED,
  loadRightsWindows,
  resolveMarketRoute,
  seedMarkets,
  type MarketRoute,
} from '@alpha/payload'
import { lexicalDocument } from '@/lib/richText'
import { db, staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

/**
 * Task 0011: catalogue search over the Postgres index (ranking, typos, Arabic, rights), the
 * index triggers, and the sitemap contents.
 */
const payload = usePayload()
const en = resolveMarketRoute(MARKETS_SEED, 'ae', 'en') as MarketRoute
const ar = resolveMarketRoute(MARKETS_SEED, 'ae', 'ar') as MarketRoute
let search: typeof import('@/lib/search')
let sitemap: typeof import('@/lib/sitemap')
let saleRule: typeof import('@/lib/saleRule')

const ctx = async () =>
  ({
    user: await staff(payload()),
    overrideAccess: false,
    context: { disableRevalidate: true },
  }) as const

async function product(input: {
  sku: string
  slug: string
  brand: number
  en: string
  ar: string
  summary?: string
  published?: boolean
}) {
  const doc = await payload().create({
    collection: 'products',
    locale: 'en',
    data: {
      title: input.en,
      summary: input.summary ?? null,
      slug: input.slug,
      sku: input.sku,
      brand: input.brand,
      markets: [{ market: 'ae', published: input.published ?? true, rrpInclVat: 1_050_000 }],
      lifecycle: 'active',
      arabicReview: 'draft',
      _status: 'published',
    },
    ...(await ctx()),
  })
  await payload().update({
    collection: 'products',
    id: doc.id,
    locale: 'ar',
    data: { title: input.ar, _status: 'published' },
    ...(await ctx()),
  })
  return doc
}

const run = async (route: MarketRoute, q: string, page = 1) =>
  search.searchCatalogue(
    payload(),
    route,
    q,
    page,
    saleRule.saleRule(await loadRightsWindows(payload())),
  )
const skus = async (route: MarketRoute, q: string) =>
  (await run(route, q)).products.map((p) => p.sku)

let amp: { id: number }

beforeAll(async () => {
  search = await import('@/lib/search')
  sitemap = await import('@/lib/sitemap')
  saleRule = await import('@/lib/saleRule')
  await seedMarkets(payload())
  const c = await ctx()
  const brand = await payload().create({
    collection: 'brands',
    data: {
      name: 'Lumen Audio',
      slug: 'lumen-audio',
      priceDisplay: 'show',
      arabicReview: 'draft',
      _status: 'published',
    },
    ...c,
  })
  const unlicensed = await payload().create({
    collection: 'brands',
    data: {
      name: 'Orbit Sound',
      slug: 'orbit-sound',
      priceDisplay: 'show',
      arabicReview: 'draft',
      _status: 'published',
    },
    ...c,
  })
  await payload().create({
    collection: 'brand-agreements',
    data: {
      brand: brand.id,
      market: 'ae',
      role: 'distributor',
      exclusive: false,
      leadRouting: 'alpha',
      validFrom: '2024-01-01T00:00:00.000Z',
    },
    ...c,
  })
  amp = await product({
    sku: 'LUM-LA100',
    slug: 'lumen-audio-la100',
    brand: brand.id,
    en: 'LA-100 integrated amplifier',
    ar: 'مضخم الصوت المتكامل LA-100',
    summary: 'Class A integrated amplifier with a phono stage.',
  })
  await product({
    sku: 'LUM-SM2',
    slug: 'lumen-audio-sm2',
    brand: brand.id,
    en: 'SM-2 standmount speakers',
    ar: 'مكبرات الصوت الرفية SM-2',
    summary: 'Two-way speakers that pair well with an integrated amplifier.',
  })
  await product({
    sku: 'LUM-HIDDEN',
    slug: 'lumen-audio-hidden',
    brand: brand.id,
    en: 'LA-900 integrated amplifier',
    ar: 'مضخم LA-900',
    published: false,
  })
  await product({
    sku: 'ORB-AMP',
    slug: 'orbit-sound-amp',
    brand: unlicensed.id,
    en: 'Orbit integrated amplifier',
    ar: 'مضخم أوربت المتكامل',
  })
})

describe('catalogue search', () => {
  it('finds a product by brand and type, model, SKU and prefix, best match first', async () => {
    // The speakers' summary mentions an amplifier too; the amplifier itself ranks first.
    expect(await skus(en, 'lumen amp')).toEqual(['LUM-LA100', 'LUM-SM2'])
    expect(await skus(en, 'LA-100')).toEqual(['LUM-LA100'])
    expect(await skus(en, 'lum-la100')).toEqual(['LUM-LA100'])
    expect(await skus(en, 'integrat')).toEqual(['LUM-LA100', 'LUM-SM2'])
    expect(await skus(en, 'amplifiers')).toEqual(['LUM-LA100', 'LUM-SM2'])
  })

  it('forgives a typo', async () => {
    expect(await skus(en, 'lumin')).toContain('LUM-LA100')
    expect(await skus(en, 'standmont')).toEqual(['LUM-SM2'])
  })

  it('searches Arabic with or without diacritics, and English model names from an Arabic page', async () => {
    expect(await skus(ar, 'مُضَخِّم')).toEqual(['LUM-LA100'])
    expect(await skus(ar, 'مضخم المتكامل')).toEqual(['LUM-LA100'])
    expect(await skus(ar, 'مكبرات')).toEqual(['LUM-SM2'])
    expect(await skus(ar, 'standmount')).toEqual(['LUM-SM2'])
  })

  it('never returns a product without rights or unpublished in the market', async () => {
    const found = await skus(en, 'integrated amplifier')
    expect(found).not.toContain('ORB-AMP')
    expect(found).not.toContain('LUM-HIDDEN')
    expect(await skus(en, 'orbit')).toEqual([])
    expect(await skus(ar, 'أوربت')).toEqual([])
  })

  it('returns nothing for an empty or symbol-only query, and counts and pages results', async () => {
    expect(await run(en, '   ')).toMatchObject({ total: 0, products: [] })
    expect(await run(en, '%%%')).toMatchObject({ total: 0 })
    expect(await run(en, 'lumen', 7)).toMatchObject({ total: 2, page: 1, pages: 1 })
  })

  it('keeps the index in step with edits (database triggers)', async () => {
    await payload().update({
      collection: 'products',
      id: amp.id,
      locale: 'en',
      data: { title: 'LA-100 Signature integrated amplifier' },
      ...(await ctx()),
    })
    expect(await skus(en, 'signature')).toEqual(['LUM-LA100'])
    await payload().update({
      collection: 'brands',
      where: { slug: { equals: 'lumen-audio' } },
      data: { name: 'Lumen Acoustics' },
      ...(await ctx()),
    })
    expect(await skus(en, 'acoustics')).toEqual(expect.arrayContaining(['LUM-LA100', 'LUM-SM2']))
  })

  it('normalises text in Postgres exactly as in core', async () => {
    for (const text of ['مُضَخِّم', 'أإآٱ ى ة', 'مكبّـــرة ٣٥٢ ۴', 'McIntosh MA352']) {
      const { rows } = await db(payload()).execute(sql`SELECT alpha_search_normalise(${text}) AS n`)
      expect(rows[0]?.['n']).toBe(normaliseSearchText(text))
    }
  })
})

describe('sitemaps', () => {
  it('lists exactly the indexable pages on sale in the market, in each locale, with hreflang', async () => {
    await payload().create({
      collection: 'pages',
      locale: 'en',
      data: {
        title: 'Returns',
        slug: 'returns',
        kind: 'legal',
        markets: ['ae'],
        body: lexicalDocument([{ heading: 'Returns', paragraphs: ['Draft.'] }]),
        arabicReview: 'draft',
        _status: 'published',
      } as never,
      ...(await ctx()),
    })
    const data = await sitemap.sitemapPages(payload(), 'ae')
    if (!data) throw new Error('ae should be live')
    const paths = data.pages.map((p) => p.path)
    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/shop',
        '/brands',
        '/brands/lumen-audio',
        '/products/lumen-audio-la100',
        '/products/lumen-audio-sm2',
        '/legal/returns',
      ]),
    )
    expect(paths).not.toContain('/products/orbit-sound-amp')
    expect(paths).not.toContain('/products/lumen-audio-hidden')
    expect(paths).not.toContain('/brands/orbit-sound')
    expect(paths.some((p) => /bag|checkout|orders|search/.test(p))).toBe(false)

    const xml = sitemap.renderSitemap(
      data.market,
      data.markets,
      data.pages,
      new URL('https://www.alphaaudios.com'),
    )
    expect(xml).toContain(
      '<loc>https://www.alphaaudios.com/ae/en/products/lumen-audio-la100/</loc>',
    )
    expect(xml).toContain(
      '<loc>https://www.alphaaudios.com/ae/ar/products/lumen-audio-la100/</loc>',
    )
    expect(xml).toContain(
      'hreflang="ar-AE" href="https://www.alphaaudios.com/ae/ar/products/lumen-audio-la100/"',
    )
    expect(xml).toContain('hreflang="x-default" href="https://www.alphaaudios.com/ae/en/"')
    expect(await sitemap.sitemapPages(payload(), 'zz')).toBeNull()
  })

  it('indexes the live markets', async () => {
    const xml = sitemap.renderSitemapIndex(MARKETS_SEED, new URL('https://www.alphaaudios.com'))
    const live = MARKETS_SEED.filter((m) => m.status === 'live').map((m) => m.code)
    for (const code of live)
      expect(xml).toContain(`<loc>https://www.alphaaudios.com/${code}/sitemap.xml</loc>`)
    expect((xml.match(/<sitemap>/g) ?? []).length).toBe(live.length)
  })
})
