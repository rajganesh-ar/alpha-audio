import { describe, expect, it } from 'vitest'
import { MARKETS_SEED } from '@alpha/payload'
import type { StockPromise } from '@alpha/core'
import { getStock } from './stock'

const promises = async (skus: readonly string[]) =>
  new Map<string, StockPromise>(
    skus.map((sku, i) => [
      sku,
      i === 0
        ? { status: 'in-stock', units: 7, eta: null }
        : { status: 'on-order', units: 0, eta: new Date('2026-11-04T00:00:00Z') },
    ]),
  )
const deps = { markets: async () => MARKETS_SEED, promises }
const call = async (url: string, market = 'ae') => {
  const response = await getStock(new Request(url), market, deps)
  return {
    status: response.status,
    cache: response.headers.get('cache-control'),
    body: (await response.json()) as Record<string, unknown>,
  }
}

describe('GET /api/v1/markets/{market}/stock', () => {
  it('returns status and ETA per SKU, never unit counts, uncached', async () => {
    const res = await call(
      'http://x/api/v1/markets/ae/stock?sku=MCINTOSH-MA352&sku=SONUSFABER-OLYMPICA-NOVA-V',
    )
    expect(res).toEqual({
      status: 200,
      cache: 'private, no-store',
      body: {
        market: 'ae',
        stock: {
          'MCINTOSH-MA352': { status: 'in-stock', eta: null },
          'SONUSFABER-OLYMPICA-NOVA-V': { status: 'on-order', eta: '2026-11-04T00:00:00.000Z' },
        },
      },
    })
    expect(JSON.stringify(res.body)).not.toContain('units')
  })

  it('404s an unknown or non-live market', async () => {
    expect((await call('http://x/?sku=A', 'zz')).status).toBe(404)
    expect((await call('http://x/?sku=A', 'sa')).status).toBe(404) // seeded, not live
  })

  it('400s missing, malformed or too many SKUs', async () => {
    expect((await call('http://x/')).status).toBe(400)
    expect((await call('http://x/?sku=lower-case')).status).toBe(400)
    expect(
      (await call(`http://x/?${Array.from({ length: 25 }, (_, i) => `sku=S${i}`).join('&')}`))
        .status,
    ).toBe(400)
  })
})
