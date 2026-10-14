import { z } from 'zod'
import { isMarketCode, liveMarkets, type MarketRecord } from '@alpha/payload'
import type { StockPromise } from '@alpha/core'
import { json, problem } from './respond'
import { MAX_SKUS, type StockResponse } from './stockLimits'

export { MAX_SKUS, type StockResponse }
const Skus = z
  .array(z.string().regex(/^[A-Z0-9][A-Z0-9-]{0,63}$/))
  .min(1)
  .max(MAX_SKUS)

/**
 * `GET /api/v1/markets/{market}/stock?sku=A&sku=B`. The market is the page's public market
 * from the URL path, as for every storefront page; no buyer context is read or accepted.
 */
export async function getStock(
  request: Request,
  market: string,
  deps: {
    markets: () => Promise<readonly MarketRecord[]>
    promises: (skus: readonly string[], market: string) => Promise<Map<string, StockPromise>>
  },
): Promise<Response> {
  if (!isMarketCode(market) || !liveMarkets(await deps.markets()).some((m) => m.code === market)) {
    return problem(404, 'unknown-market', 'No such market.')
  }
  const skus = Skus.safeParse(new URL(request.url).searchParams.getAll('sku'))
  if (!skus.success)
    return problem(
      400,
      'invalid-request',
      `Pass 1 to ${MAX_SKUS} sku parameters.`,
      skus.error.flatten(),
    )
  const promises = await deps.promises(skus.data, market)
  const body: StockResponse = {
    market,
    stock: Object.fromEntries(
      [...promises].map(([sku, p]) => [
        sku,
        { status: p.status, eta: p.eta?.toISOString() ?? null },
      ]),
    ),
  }
  return json(body)
}
