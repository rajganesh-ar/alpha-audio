import { getPayload } from 'payload'
import config from '@payload-config'
import { getMarketsCached, resolveMarketRoute } from '@alpha/payload'

/**
 * Whether `/{market}/{locale}/` is routable: the market is live and offers the locale. Read
 * from the process-wide Markets cache (one database read per 30 s per process).
 */
export async function isRoutableMarket(market: string, locale: string): Promise<boolean> {
  const markets = await getMarketsCached(await getPayload({ config }))
  return resolveMarketRoute(markets, market, locale) !== null
}
