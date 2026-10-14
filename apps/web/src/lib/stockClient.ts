import { MAX_SKUS, type StockResponse } from './api/stockLimits'

export type LiveStock = StockResponse['stock'][string]

type Resolve = (stock: LiveStock | null) => void

/**
 * Browser side of the live stock line. Lines that ask in the same tick share one request per
 * market (a home page with eight cards makes one call), in chunks of the API's limit.
 */
const queue = new Map<string, Map<string, Resolve[]>>()

async function request(market: string, skus: readonly string[]): Promise<StockResponse | null> {
  const query = skus.map((s) => `sku=${encodeURIComponent(s)}`).join('&')
  try {
    const response = await fetch(`/api/v1/markets/${market}/stock?${query}`, {
      cache: 'no-store',
      credentials: 'omit',
    })
    return response.ok ? ((await response.json()) as StockResponse) : null
  } catch {
    return null
  }
}

async function flush(market: string): Promise<void> {
  const waiting = queue.get(market)
  queue.delete(market)
  if (!waiting) return
  const skus = [...waiting.keys()]
  for (let i = 0; i < skus.length; i += MAX_SKUS) {
    const chunk = skus.slice(i, i + MAX_SKUS)
    const result = await request(market, chunk)
    for (const sku of chunk)
      for (const resolve of waiting.get(sku) ?? []) resolve(result?.stock[sku] ?? null)
  }
}

export function fetchStock(market: string, sku: string): Promise<LiveStock | null> {
  return new Promise((resolve) => {
    let waiting = queue.get(market)
    if (!waiting) {
      waiting = new Map()
      queue.set(market, waiting)
      queueMicrotask(() => void flush(market))
    }
    waiting.set(sku, [...(waiting.get(sku) ?? []), resolve])
  })
}
