import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  getMarketsCached,
  resolveMarketRoute,
  type MarketRecord,
  type MarketRoute,
} from '@alpha/payload'

/** The Markets record, read once per render and cached in-process for 30 s between renders. */
export const getMarkets = cache(async (): Promise<MarketRecord[]> => {
  return getMarketsCached(await getPayload({ config }))
})

/** The route for `[market]/[locale]` params, or null when the market is not live or lacks the locale. */
export const getMarketRoute = cache(
  async (market: string, locale: string): Promise<MarketRoute | null> =>
    resolveMarketRoute(await getMarkets(), market, locale),
)

/**
 * For pages under `[market]/[locale]`: the route, or a 404. Every page calls this. The layout
 * cannot 404 itself (a root layout has no not-found boundary above it), so it renders a bare
 * document for an invalid pair and relies on the page's notFound(), which the segment's
 * not-found.tsx catches and renders server-side with status 404.
 */
export async function requireMarketRoute(
  params: Promise<{ market: string; locale: string }>,
): Promise<MarketRoute> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) notFound()
  return route
}
