import config from '@payload-config'
import { getPayload } from 'payload'
import { renderSitemap, sitemapPages } from '@/lib/sitemap'
import { siteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

/** One market's sitemap: every indexable page on sale there, in each of its locales. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ market: string }> },
): Promise<Response> {
  const data = await sitemapPages(await getPayload({ config }), (await params).market)
  if (!data) return new Response('Not found', { status: 404 })
  return new Response(renderSitemap(data.market, data.markets, data.pages, siteUrl()), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
