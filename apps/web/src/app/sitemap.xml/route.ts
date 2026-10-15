import config from '@payload-config'
import { getPayload } from 'payload'
import { getMarketsCached } from '@alpha/payload'
import { renderSitemapIndex } from '@/lib/sitemap'
import { siteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

/** Sitemap index: one sitemap per live market (docs/tasks/0011). */
export async function GET(): Promise<Response> {
  const markets = await getMarketsCached(await getPayload({ config }))
  return new Response(renderSitemapIndex(markets, siteUrl()), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
