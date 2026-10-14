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
  name: z.object({ en: z.string().min(1), ar: z.string().min(1) }),
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
 * Process-local cache of the Markets global, for server code that renders on every request
 * (the 404 page). Bounds database reads to one per TTL per instance; the `revalidateMarkets`
 * hook clears it immediately on the instance that saved the change. ISR pages do not need
 * it: they read once per render and are purged by the same hook.
 */
const DEFAULT_TTL_MS = 30_000
let cached: { value: MarketRecord[]; expiresAt: number } | undefined

export async function getMarketsCached(
  payload: Payload,
  ttlMs: number = DEFAULT_TTL_MS,
  now: () => number = Date.now,
): Promise<MarketRecord[]> {
  if (cached && cached.expiresAt > now()) return cached.value
  const value = await loadMarkets(payload)
  cached = { value, expiresAt: now() + ttlMs }
  return value
}

export function invalidateMarketsCache(): void {
  cached = undefined
}
