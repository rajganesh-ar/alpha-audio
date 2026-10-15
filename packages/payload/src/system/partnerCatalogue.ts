import type { Payload } from 'payload'
import {
  money,
  pageOf,
  parseSearchQuery,
  publishedIn,
  resolvePrices,
  stockBand,
  type Money,
  type ResolvedLine,
  type TraceStep,
} from '@alpha/core'
import type { LocaleCode } from '../markets/codes'
import { getMarketsCached } from '../markets/read'
import { createLedger } from './ledgerStore'
import { brandsSellableIn, loadRightsWindows } from './marketRights'
import { createReceiving } from './purchasingStore'
import { companyContext, loadPricingData, type CompanyContext } from './pricing'
import { MAX_SEARCH_CANDIDATES, searchProductIds } from './search'

/**
 * The dealer board catalogue (docs/tasks/0014): products on sale in the signed-in company's
 * market with the company's own resolved price, the RRP, the trace and stock as the company may
 * see it. Products are read as the user (`overrideAccess: false`), so cost stays behind its
 * field access; pricing inputs are read by `loadPricingData` (system) and only the outcome
 * leaves here. The company always comes from the user record.
 */

export const PARTNER_PAGE_SIZE = 50
/** Upper bound on products considered for one market (the catalogue is a few hundred). */
const MAX_CANDIDATES = 2_000

/** Trace steps a company sees: its own base and adjustments, never the internal floor. */
const HIDDEN_STEPS: ReadonlySet<TraceStep['rule']> = new Set(['project', 'margin-floor'])

export interface PartnerStock {
  /** `exact` units, a band (`10+`, `3–9`, `Low`, `0`), or null when the company sees none. */
  band: string | null
  /** Earliest open purchase order date (ISO) when none is in stock and stock is visible. */
  eta: string | null
}

export interface PartnerCatalogueRow {
  id: number
  sku: string
  slug: string
  title: string
  brand: string | null
  /** Consumer RRP incl. VAT in the market. */
  rrpInclVat: Money | null
  line: ResolvedLine
  stock: PartnerStock
}

export interface PartnerCatalogue {
  company: CompanyContext['company']
  currency: CompanyContext['context']['currency']
  decimals: CompanyContext['context']['decimals']
  vatRate: number
  query: string
  rows: PartnerCatalogueRow[]
  page: number
  pages: number
  total: number
}

export interface PartnerCatalogueOptions {
  locale: LocaleCode
  page?: number | undefined
  q?: string | undefined
  perPage?: number | undefined
  at?: Date | undefined
}

interface ProductDoc {
  id: number
  sku: string
  slug: string
  title?: string | null
  brand?: number | { id: number; name?: string | null } | null
  markets?: Array<{ market: string; published?: boolean | null; rrpInclVat?: number | null }> | null
}

const brandId = (p: ProductDoc) =>
  p.brand === null || p.brand === undefined
    ? null
    : String(typeof p.brand === 'object' ? p.brand.id : p.brand)

/** The company's catalogue page; null when the user is not a company user. */
export async function partnerCatalogue(
  payload: Payload,
  user: unknown,
  options: PartnerCatalogueOptions,
): Promise<PartnerCatalogue | null> {
  const at = options.at ?? new Date()
  const session = await companyContext(payload, user, at)
  if (!session) return null
  const { company, context } = session
  const query = parseSearchQuery(options.q)
  const ranked = query.tsquery
    ? await searchProductIds(payload, query, options.locale, MAX_SEARCH_CANDIDATES)
    : null

  const [found, windows] = await Promise.all([
    ranked && ranked.length === 0
      ? Promise.resolve({ docs: [] })
      : payload.find({
          collection: 'products',
          where: {
            and: [
              { 'markets.market': { equals: company.market } },
              ...(ranked ? [{ id: { in: ranked } }] : []),
            ],
          },
          locale: options.locale,
          sort: 'title',
          depth: 1,
          limit: MAX_CANDIDATES,
          pagination: false,
          draft: false,
          user: user as never, // reason: the caller's authenticated user, typed by Payload per app
          overrideAccess: false,
          select: { sku: true, slug: true, title: true, brand: true, markets: true },
        }),
    loadRightsWindows(payload),
  ])
  const sellable = brandsSellableIn(windows, company.market, at)
  const onSale = (found.docs as unknown as ProductDoc[]).filter(
    (p) => publishedIn(p.markets, company.market) && sellable.has(brandId(p) ?? ''),
  )
  // Search results keep their rank; the plain catalogue is by title.
  const order = ranked ? new Map(ranked.map((id, i) => [id, i])) : null
  if (order) onSale.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

  const window = pageOf(onSale, options.page ?? 1, options.perPage ?? PARTNER_PAGE_SIZE)
  const data = await loadPricingData(
    payload,
    context,
    window.items.map((p) => p.sku),
  )
  const prices = resolvePrices(
    context,
    window.items.map((p) => ({ sku: p.sku, qty: 1 })),
    data,
  )
  const ledger = createLedger(payload)
  const receiving = createReceiving(payload)
  const rows = await Promise.all(
    window.items.map(async (p, i): Promise<PartnerCatalogueRow> => {
      const resolved = prices.lines[i] as ResolvedLine
      const entry = (p.markets ?? []).find((e) => e.market === company.market && e.published)
      const units = await ledger.sellable(p.sku, company.market)
      const band = stockBand(units, company.stockVisibility)
      const eta =
        band !== null && units <= 0 ? await receiving.openPurchaseEta(p.sku, company.market) : null
      return {
        id: p.id,
        sku: p.sku,
        slug: p.slug,
        title: p.title ?? p.sku,
        brand: typeof p.brand === 'object' && p.brand ? (p.brand.name ?? null) : null,
        rrpInclVat:
          typeof entry?.rrpInclVat === 'number'
            ? money(BigInt(entry.rrpInclVat), context.currency, context.decimals)
            : null,
        line: partnerLine(resolved),
        stock: { band, eta: eta ? eta.toISOString() : null },
      }
    }),
  )
  return {
    company,
    currency: context.currency,
    decimals: context.decimals,
    vatRate: context.vatRate,
    query: query.text,
    rows,
    page: window.page,
    pages: window.pages,
    total: window.total,
  }
}

/** A resolved line as a company may see it: the trace without internal steps. */
export function partnerLine(line: ResolvedLine): ResolvedLine {
  return { ...line, trace: line.trace.filter((s) => !HIDDEN_STEPS.has(s.rule)) }
}

export interface PartnerAccount {
  user: { id: number; email: string; name: string | null; role: string; locale: 'en' | 'ar' }
  company: { id: number; name: string; market: string; tier: string }
  /** The market's IANA time zone, for dates. */
  timezone: string
  vatRate: number
  currency: CompanyContext['context']['currency']
  decimals: CompanyContext['context']['decimals']
  /** Owner and purchaser only (field access); null for everyone else. */
  creditLimit: Money | null
  /** True when ordering is blocked; null when the user may not see the account's terms. */
  hold: boolean | null
}

/**
 * What the dealer board header shows (docs/tasks/0014). The company is read as the user, so its
 * field access decides what appears: a viewer never receives the credit limit or hold flag.
 */
export async function partnerAccount(
  payload: Payload,
  user: unknown,
): Promise<PartnerAccount | null> {
  const session = await companyContext(payload, user)
  if (!session) return null
  const doc = (await payload.findByID({
    collection: 'companies',
    id: session.company.id,
    depth: 0,
    user: user as never, // reason: the caller's authenticated user, typed by Payload per app
    overrideAccess: false,
    disableErrors: true,
  })) as {
    name: string
    tier?: string | null
    creditLimit?: number | null
    hold?: boolean | null
  } | null
  if (!doc) return null
  const u = user as {
    id: number
    email: string
    name?: string | null
    role?: string
    locale?: string
  }
  return {
    user: {
      id: u.id,
      email: u.email,
      name: u.name ?? null,
      role: u.role ?? 'viewer',
      locale: u.locale === 'ar' ? 'ar' : 'en',
    },
    company: {
      id: session.company.id,
      name: doc.name,
      market: session.company.market,
      tier: doc.tier ?? 'standard',
    },
    timezone:
      (await getMarketsCached(payload)).find((m) => m.code === session.company.market)?.timezone ??
      'Asia/Dubai',
    vatRate: session.context.vatRate,
    currency: session.context.currency,
    decimals: session.context.decimals,
    creditLimit:
      typeof doc.creditLimit === 'number'
        ? money(BigInt(doc.creditLimit), session.context.currency, session.context.decimals)
        : null,
    hold: typeof doc.hold === 'boolean' ? doc.hold : null,
  }
}
