import type { Payload } from 'payload'
import { z } from 'zod'
import {
  ADDRESS_SCHEMES,
  FULFILMENT_MODES,
  LOCALE_CODES,
  MARKET_CODES,
  MARKET_STATUSES,
  PAYMENT_RAILS,
} from './codes'
import type { MarketRecord } from './types'

export const MARKETS_SLUG = 'markets'

/**
 * Shape of one market as stored. Parsing at this boundary means pricing, VAT and routing
 * never see a half-filled or malformed record, and `packages/payload` does not depend on the
 * app's generated types (packages never import apps).
 */
const marketSchema = z.object({
  code: z.enum(MARKET_CODES),
  // A market added in the admin in English only has no Arabic name yet. That must not take
  // the storefront down (every page reads this record), so Arabic falls back to English
  // until the native reviewer fills it in.
  name: z
    .object({ en: z.string().min(1), ar: z.string().nullish() })
    .transform(({ en, ar }) => ({ en, ar: ar?.trim() ? ar : en })),
  currency: z.enum(['AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR']),
  decimals: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  vatRate: z.number().min(0).max(100),
  locales: z.array(z.enum(LOCALE_CODES)).min(1),
  payments: z.array(z.enum(PAYMENT_RAILS)),
  addressScheme: z.enum(ADDRESS_SCHEMES),
  fulfilment: z.enum(FULFILMENT_MODES),
  status: z.enum(MARKET_STATUSES),
  timezone: z.string().min(1),
})

const globalSchema = z.object({ markets: z.array(marketSchema).nullish() })

/** Parses the Markets global as returned by `findGlobal({ locale: 'all' })`. */
export function parseMarketsGlobal(doc: unknown): MarketRecord[] {
  const parsed = globalSchema.safeParse(doc)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`Markets global is invalid:\n  ${issues.join('\n  ')}`)
  }
  return parsed.data.markets ?? []
}

/** Reads every market, with names in all locales. Public data, so no user is needed. */
export async function loadMarkets(payload: Payload): Promise<MarketRecord[]> {
  const doc = await payload.findGlobal({
    slug: MARKETS_SLUG,
    locale: 'all',
    depth: 0,
    overrideAccess: false,
  })
  return parseMarketsGlobal(doc)
}

/**
 * Process-wide cache of the Markets global. The proxy checks every storefront URL against it
 * and the 404 page renders on every request, so database reads are bounded to one per TTL per
 * process. It lives on `globalThis` because Next bundles the proxy and the app separately: a
 * module variable would give each bundle its own copy, and the `revalidateMarkets` hook would
 * only clear one of them. Concurrent misses share a single read.
 */
const DEFAULT_TTL_MS = 30_000
const CACHE_KEY = Symbol.for('alpha.marketsCache')

interface CacheSlot {
  value?: MarketRecord[] | undefined
  expiresAt: number
  pending?: Promise<MarketRecord[]> | undefined
}

function slot(): CacheSlot {
  const store = globalThis as unknown as Record<symbol, CacheSlot | undefined>
  return (store[CACHE_KEY] ??= { expiresAt: 0 })
}

export async function getMarketsCached(
  payload: Payload,
  ttlMs: number = DEFAULT_TTL_MS,
  now: () => number = Date.now,
): Promise<MarketRecord[]> {
  const cache = slot()
  if (cache.value && cache.expiresAt > now()) return cache.value
  if (!cache.pending) {
    const pending = loadMarkets(payload)
      .then((value) => {
        cache.value = value
        cache.expiresAt = now() + ttlMs
        return value
      })
      .finally(() => {
        if (cache.pending === pending) cache.pending = undefined
      })
    cache.pending = pending
  }
  return cache.pending
}

export function invalidateMarketsCache(): void {
  const cache = slot()
  cache.value = undefined
  cache.expiresAt = 0
  cache.pending = undefined
}
