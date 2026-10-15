import type { Payload } from 'payload'
import {
  brandsSellableIn,
  getMarketsCached,
  liveMarkets,
  loadRightsWindows,
  type MarketRecord,
} from '@alpha/payload'
import { publishedInMarket } from './content'
import { saleRule } from './saleRule'
import { hreflangLinks, localizedPath, type HreflangLink } from './seo'

/**
 * Sitemaps (docs/tasks/0011, spec: Sitemap, URL scheme and redirects): one per market listing
 * every indexable page on sale there, in each of its locales, with the hreflang set; an index
 * of the live markets at `/sitemap.xml`. Private and per-visitor pages (bag, checkout, orders,
 * search) are never listed.
 */

export interface SitemapPage {
  /** The part of the URL after `/{market}/{locale}`. */
  path: string
  lastmod: Date | null
  /** Markets the page exists in (for hreflang). */
  in: (market: MarketRecord) => boolean
}

const xml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c,
  )

export function renderSitemap(
  market: MarketRecord,
  markets: readonly MarketRecord[],
  pages: readonly SitemapPage[],
  origin: URL,
): string {
  const abs = (path: string) => new URL(path, origin).toString()
  const urls = pages.flatMap((page) => {
    const alternates: HreflangLink[] = hreflangLinks(markets, page.path, page.in)
    return market.locales.map((locale) =>
      [
        '  <url>',
        `    <loc>${xml(abs(localizedPath(market.code, locale, page.path)))}</loc>`,
        ...(page.lastmod ? [`    <lastmod>${page.lastmod.toISOString()}</lastmod>`] : []),
        ...alternates.map(
          (a) =>
            `    <xhtml:link rel="alternate" hreflang="${xml(a.hrefLang)}" href="${xml(abs(a.href))}"/>`,
        ),
        '  </url>',
      ].join('\n'),
    )
  })
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`
}

export function renderSitemapIndex(markets: readonly MarketRecord[], origin: URL): string {
  const entries = liveMarkets(markets).map(
    (m) =>
      `  <sitemap>\n    <loc>${xml(new URL(`/${m.code}/sitemap.xml`, origin).toString())}</loc>\n  </sitemap>`,
  )
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>
`
}

const date = (value: string | null | undefined) => (value ? new Date(value) : null)

/** Every indexable page on sale in `marketCode`, read as an anonymous visitor (published only). */
export async function sitemapPages(
  payload: Payload,
  marketCode: string,
  now: Date = new Date(),
): Promise<{ market: MarketRecord; markets: MarketRecord[]; pages: SitemapPage[] } | null> {
  const markets = await getMarketsCached(payload)
  const market = liveMarkets(markets).find((m) => m.code === marketCode)
  if (!market) return null
  const read = {
    overrideAccess: false,
    draft: false,
    depth: 0,
    limit: 5000,
    pagination: false,
  } as const
  const [windows, products, brands, categories, legal] = await Promise.all([
    loadRightsWindows(payload),
    payload.find({ collection: 'products', ...read }),
    payload.find({ collection: 'brands', ...read }),
    payload.find({ collection: 'categories', ...read }),
    payload.find({ collection: 'pages', where: { kind: { equals: 'legal' } }, ...read }),
  ])
  const onSale = saleRule(windows, now)
  const sellable = new Map<string, Set<string>>()
  const brandSellable = (brand: number, m: MarketRecord) => {
    let set = sellable.get(m.code)
    if (!set) sellable.set(m.code, (set = brandsSellableIn(windows, m.code, now)))
    return set.has(String(brand))
  }
  const everywhere = () => true
  const pages: SitemapPage[] = [
    { path: '/', lastmod: null, in: everywhere },
    { path: '/shop', lastmod: null, in: everywhere },
    { path: '/brands', lastmod: null, in: everywhere },
    ...categories.docs
      .filter((c) => categoryPath(c, categories.docs).split('/').length <= 2)
      .map((c) => ({
        path: `/shop/${categoryPath(c, categories.docs)}`,
        lastmod: date(c.updatedAt),
        in: everywhere,
      })),
    ...brands.docs
      .filter((b) => brandSellable(b.id, market))
      .map((b) => ({
        path: `/brands/${b.slug}`,
        lastmod: date(b.updatedAt),
        in: (m: MarketRecord) => brandSellable(b.id, m),
      })),
    ...products.docs
      .filter((p) => onSale(p, market.code))
      .map((p) => ({
        path: `/products/${p.slug}`,
        lastmod: date(p.updatedAt),
        in: (m: MarketRecord) => onSale(p, m.code),
      })),
    ...legal.docs
      .filter((p) => publishedInMarket(p, market.code))
      .map((p) => ({
        path: `/legal/${p.slug}`,
        lastmod: date(p.updatedAt),
        in: (m: MarketRecord) => publishedInMarket(p, m.code),
      })),
  ]
  return { market, markets, pages }
}

type CategoryDoc = { id: number; slug: string; parent?: number | { id: number } | null }

/** `amplifiers/integrated-amplifiers`: listings are addressed by the category trail. */
function categoryPath(category: CategoryDoc, all: readonly CategoryDoc[]): string {
  const trail: string[] = []
  let current: CategoryDoc | undefined = category
  for (let depth = 0; current && depth < 5; depth++) {
    trail.unshift(current.slug)
    const parent: CategoryDoc['parent'] = current.parent
    const parentId: number | undefined =
      typeof parent === 'object' ? parent?.id : (parent ?? undefined)
    current = parentId ? all.find((c) => c.id === parentId) : undefined
  }
  return trail.join('/')
}
