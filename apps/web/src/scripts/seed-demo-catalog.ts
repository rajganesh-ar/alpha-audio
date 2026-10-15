/**
 * Local development only: four brands, nine categories, twelve products with generated
 * placeholder images, and the Home page, in English with draft Arabic. When the demo warehouse
 * exists (seed:inventory), it also books opening stock through the ledger and raises an open
 * purchase order, so the storefront shows every stock state.
 *
 *   pnpm --filter @alpha/web seed:inventory   # optional, for stock
 *   pnpm --filter @alpha/web seed:catalog
 *
 * Refuses to run in production. Safe to re-run: it stops if the brands already exist.
 */
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { createLedger, ensureStaffUser, loadMarkets } from '@alpha/payload'
import type { Media } from '@/payload-types'
import {
  AGREEMENTS,
  BRANDS,
  CATEGORIES,
  HOME,
  OPENING_STOCK,
  PRODUCTS,
  type DemoText,
} from './demo/catalogData'
import { heroPoster, productImage } from './demo/placeholderImages'

if (process.env.NODE_ENV === 'production') {
  console.error('seed:catalog is for local development and refuses to run in production.')
  process.exit(1)
}

const payload: Payload = await getPayload({ config })
const user = await ensureStaffUser(payload, {
  email: 'dev@alpha.local',
  password: 'dev-password-123',
})
// Seeds run outside a Next.js request: skip the storefront revalidation hooks. A fresh context
// per call: Payload's cloud-storage plugin sets a flag on the context it is handed, and a
// shared object would make every later upload skip storage.
const as = () => ({ user, overrideAccess: false, context: { disableRevalidate: true } }) as const

const existing = await payload.find({
  collection: 'brands',
  where: { slug: { equals: 'mcintosh' } },
  draft: true,
  ...as(),
})
if (existing.docs.length) {
  payload.logger.info('Demo catalogue already seeded (brand mcintosh exists); nothing to do.')
  process.exit(0)
}

const markets = new Map((await loadMarkets(payload)).map((m) => [m.code, m]))

async function upload(name: string, data: Buffer, alt: DemoText): Promise<Media> {
  const doc = await payload.create({
    collection: 'media',
    data: { alt: alt.en },
    file: { data, mimetype: 'image/webp', name, size: data.length },
    locale: 'en',
    ...as(),
  })
  await payload.update({
    collection: 'media',
    id: doc.id,
    data: { alt: alt.ar },
    locale: 'ar',
    ...as(),
  })
  return doc
}

const categoryIds = new Map<string, number>()
for (const c of CATEGORIES) {
  const doc = await payload.create({
    collection: 'categories',
    data: {
      title: c.title.en,
      slug: c.slug,
      order: c.order,
      ...(c.facetSpecs ? { facetSpecs: c.facetSpecs } : {}),
      ...(c.summary ? { summary: c.summary.en } : {}),
      ...(c.parent ? { parent: categoryIds.get(c.parent) ?? null } : {}),
      arabicReview: 'draft',
      _status: 'published',
    },
    locale: 'en',
    ...as(),
  })
  await payload.update({
    collection: 'categories',
    id: doc.id,
    data: {
      title: c.title.ar,
      ...(c.summary ? { summary: c.summary.ar } : {}),
      _status: 'published',
    },
    locale: 'ar',
    ...as(),
  })
  categoryIds.set(c.slug, doc.id)
}

const brandIds = new Map<string, number>()
for (const b of BRANDS) {
  const doc = await payload.create({
    collection: 'brands',
    data: {
      name: b.name,
      slug: b.slug,
      priceDisplay: b.priceDisplay,
      story: b.story.en,
      arabicReview: 'draft',
      _status: 'published',
    },
    locale: 'en',
    ...as(),
  })
  await payload.update({
    collection: 'brands',
    id: doc.id,
    data: { story: b.story.ar, _status: 'published' },
    locale: 'ar',
    ...as(),
  })
  brandIds.set(b.slug, doc.id)
}

for (const a of AGREEMENTS) {
  await payload.create({
    collection: 'brand-agreements',
    data: {
      brand: brandIds.get(a.brand) as number,
      market: a.market,
      role: a.role,
      exclusive: a.exclusive,
      validFrom: `${a.validFrom}T00:00:00.000Z`,
      ...(a.validTo ? { validTo: `${a.validTo}T00:00:00.000Z` } : {}),
      leadRouting: 'alpha',
      ...(a.flags ? { complianceFlags: a.flags } : {}),
    },
    ...as(),
  })
}

const productIds = new Map<string, number>()
for (const p of PRODUCTS) {
  const gallery = []
  for (const view of [0, 1, 2]) {
    gallery.push(
      (await upload(`${p.slug}-${view + 1}.webp`, await productImage(p.shape, view), p.alt)).id,
    )
  }
  const rows = Object.entries(p.prices).map(([code, price]) => {
    const market = markets.get(code as 'ae' | 'sa')
    if (!market) throw new Error(`Run seed:markets first: market ${code} is missing.`)
    return price === 'request'
      ? { market: market.code, published: true, priceDisplay: 'request' as const }
      : {
          market: market.code,
          published: true,
          priceDisplay: 'show' as const,
          rrpInclVat: price * 10 ** market.decimals,
        }
  })
  const doc = await payload.create({
    collection: 'products',
    data: {
      title: p.title.en,
      slug: p.slug,
      sku: p.sku,
      brand: brandIds.get(p.brand) as number,
      categories: p.categories.map((c) => categoryIds.get(c) as number),
      summary: p.summary.en,
      gallery,
      specs: p.specs,
      markets: rows,
      lifecycle: 'active',
      arabicReview: 'draft',
      _status: 'published',
    },
    locale: 'en',
    ...as(),
  })
  const inputs = typeof p.specs['inputs'] === 'string' ? { specs: { ...p.specs } } : {}
  await payload.update({
    collection: 'products',
    id: doc.id,
    data: { title: p.title.ar, summary: p.summary.ar, ...inputs, _status: 'published' },
    locale: 'ar',
    ...as(),
  })
  productIds.set(p.sku, doc.id)
}

const poster = await upload('home-hero.webp', await heroPoster(), HOME.hero.alt)
const homeData = (locale: 'en' | 'ar') => ({
  hero: {
    poster: poster.id,
    eyebrow: HOME.hero.eyebrow[locale],
    headline: HOME.hero.headline[locale],
    lede: HOME.hero.lede[locale],
    ctaLabel: HOME.hero.ctaLabel[locale],
    ctaHref: HOME.hero.ctaHref,
  },
  entryCards: HOME.entryCards.map((c) => ({
    tool: c.tool,
    title: c.title[locale],
    body: c.body[locale],
    ctaLabel: c.ctaLabel[locale],
  })),
  featuredTitle: HOME.featuredTitle[locale],
  categoriesTitle: HOME.categoriesTitle[locale],
  featured: HOME.featured.map((sku) => productIds.get(sku) as number),
  topCategories: HOME.topCategories.map((slug) => categoryIds.get(slug) as number),
  seo: { title: HOME.seo.title[locale], description: HOME.seo.description[locale] },
  arabicReview: 'draft' as const,
  _status: 'published' as const,
})
const home = await payload.updateGlobal({
  slug: 'home',
  data: homeData('en'),
  locale: 'en',
  ...as(),
})
// Array rows keep their ids across locales, so the Arabic pass updates the same entry cards.
const ar = homeData('ar')
await payload.updateGlobal({
  slug: 'home',
  data: {
    ...ar,
    entryCards: ar.entryCards.map((c, i) => ({ ...c, id: home.entryCards?.[i]?.id ?? null })),
  },
  locale: 'ar',
  ...as(),
})

// Stock, when the demo warehouse exists.
const shelves = await payload.find({
  collection: 'locations',
  where: { code: { equals: 'DXB-WH1-A01' } },
  ...as(),
})
const shelf = shelves.docs[0]
if (shelf) {
  const ledger = createLedger(payload)
  for (const [sku, qty] of Object.entries(OPENING_STOCK)) {
    await ledger.move({
      sku,
      qty,
      from: null,
      to: 'available',
      location: shelf.id,
      doc: { type: 'opening', id: 'OB-2026-0002' },
      user: user.id,
    })
  }
  const warehouse = typeof shelf.warehouse === 'object' ? shelf.warehouse.id : shelf.warehouse
  const suppliers = await payload.find({
    collection: 'suppliers',
    where: { code: { equals: 'SONUSFABER-IT' } },
    ...as(),
  })
  const supplier =
    suppliers.docs[0] ??
    (await payload.create({
      collection: 'suppliers',
      data: {
        code: 'SONUSFABER-IT',
        name: 'Sonus faber',
        country: 'IT',
        currency: 'EUR',
        leadTimeDays: 60,
      },
      ...as(),
    }))
  const eta = new Date(Date.now() + 21 * 86_400_000)
  eta.setUTCHours(0, 0, 0, 0)
  await payload.create({
    collection: 'purchase-orders',
    data: {
      number: 'PO-2026-0101',
      supplier: supplier.id,
      warehouse,
      currency: 'EUR',
      decimals: 2,
      expectedAt: eta.toISOString(),
      status: 'ordered',
      lines: [
        {
          sku: 'SONUSFABER-OLYMPICA-NOVA-V',
          description: 'Olympica Nova V, walnut',
          qtyOrdered: 2,
          unitCost: 1_150_000,
        },
      ],
    },
    ...as(),
  })
  payload.logger.info(
    `Opening stock booked for ${Object.keys(OPENING_STOCK).length} SKUs; PO-2026-0101 expected ${eta.toISOString().slice(0, 10)}.`,
  )
} else {
  payload.logger.info(
    'No demo warehouse (run seed:inventory first for stock); products will show out of stock.',
  )
}

payload.logger.info(
  `Demo catalogue seeded: ${BRANDS.length} brands, ${AGREEMENTS.length} agreements, ${CATEGORIES.length} categories, ${PRODUCTS.length} products, Home page.`,
)
process.exit(0)
