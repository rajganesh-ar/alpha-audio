import type { Payload } from 'payload'
import {
  publishedIn,
  resolvePrices,
  type Channel,
  type ContractPrice,
  type CurrencyCode,
  type CurrencyDecimals,
  type GroupDiscount,
  type PriceContext,
  type PriceLine,
  type PriceRule,
  type PricingData,
  type PricingProduct,
  type ProjectPrice,
  type ResolvedPrices,
  type StockVisibility,
} from '@alpha/core'
import { companyOf } from '../access'
import { getMarketsCached } from '../markets/read'
import { brandsSellableIn, loadRightsWindows } from './marketRights'

/**
 * Dealer pricing for a signed-in company user (docs/tasks/0013, ADR 0013). System code: the
 * rules (contracts, price lists, groups, promotions, landed cost) are staff-only, so they are
 * read here with `overrideAccess: true` and only the outcome leaves: the resolved price and its
 * trace. The company always comes from the user record, never from the caller.
 */

const system = {
  depth: 0,
  // System read: pricing inputs are staff-only; see the module comment.
  overrideAccess: true,
} as const
const id = (v: unknown): number | null =>
  typeof v === 'number'
    ? v
    : v && typeof v === 'object' && 'id' in v
      ? Number((v as { id: unknown }).id)
      : null
const date = (v: unknown) => (typeof v === 'string' && v ? new Date(v) : null)
const big = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? BigInt(Math.trunc(v)) : null

export interface CompanyContext {
  company: {
    id: number
    name: string
    market: string
    channel: Channel
    stockVisibility: StockVisibility
  }
  context: PriceContext
}

/** The pricing context of a company user's session; null for anyone who is not one. */
export async function companyContext(
  payload: Payload,
  user: unknown,
  at: Date = new Date(),
): Promise<CompanyContext | null> {
  const companyId = companyOf(user)
  if (companyId === null) return null
  const company = (await payload.findByID({
    collection: 'companies',
    id: companyId,
    ...system,
    disableErrors: true,
  })) as {
    id: number
    name: string
    market: string
    channel: Channel
    settings?: { stockVisibility?: StockVisibility }
  } | null
  if (!company) return null
  const market = (await getMarketsCached(payload)).find((m) => m.code === company.market)
  if (!market) return null
  return {
    company: {
      id: company.id,
      name: company.name,
      market: company.market,
      channel: company.channel,
      stockVisibility: company.settings?.stockVisibility ?? 'banded',
    },
    context: {
      company: company.id,
      market: company.market,
      currency: market.currency as CurrencyCode,
      decimals: market.decimals as CurrencyDecimals,
      vatRate: market.vatRate,
      channel: company.channel,
      at,
    },
  }
}

interface ProductDoc {
  sku: string
  _status?: string | null
  brand?: unknown
  categories?: unknown[] | null
  cost?: number | null
  markets?: Array<{ market: string; published?: boolean | null; rrpInclVat?: number | null }> | null
}
interface ContractDoc {
  sku: string
  price: number
  validFrom?: string | null
  validTo?: string | null
}
interface RuleDoc {
  kind: 'volume' | 'promotion'
  sku?: string | null
  brand?: unknown
  minQty: number
  bps: number
  stackable?: boolean | null
  markets?: string[] | null
  validFrom?: string | null
  validTo?: string | null
}
interface ListDoc {
  _status?: string | null
  market: string
  items?: Array<{ sku: string; price: number }> | null
  validFrom?: string | null
  validTo?: string | null
}
interface GroupDoc {
  priceList?: unknown
  discounts?: Array<{ brand?: unknown; category?: unknown; bps: number }> | null
}
interface CompanyDoc {
  buyerGroup?: unknown
  priceList?: unknown
}
interface SettingsDoc {
  channelFactors?: {
    dealer?: number | null
    integrator?: number | null
    retailer?: number | null
  } | null
  targetMargin?: number | null
  marginFloor?: number | null
  fxRates?: Array<{ currency: string; aedPerUnit: string }> | null
}

const AED_MICROS = 1_000_000

function micros(decimal: string): bigint {
  const [whole = '0', fraction = ''] = decimal.split('.')
  return BigInt(whole) * BigInt(AED_MICROS) + BigInt((fraction + '000000').slice(0, 6))
}

/** Everything the engine needs for one company and these SKUs, and nothing about anyone else. */
export async function loadPricingData(
  payload: Payload,
  ctx: PriceContext,
  skus: readonly string[],
  options: { projectPrices?: readonly ProjectPrice[] | undefined } = {},
): Promise<PricingData> {
  const unique = [...new Set(skus)]
  const [companyRaw, settingsRaw, windows, productsRaw, contractsRaw, rulesRaw] = await Promise.all(
    [
      payload.findByID({ collection: 'companies', id: Number(ctx.company), ...system }),
      payload.findGlobal({ slug: 'pricing-settings', ...system }),
      loadRightsWindows(payload),
      unique.length
        ? payload.find({
            collection: 'products',
            where: { sku: { in: unique } },
            limit: unique.length,
            draft: false,
            ...system,
          })
        : Promise.resolve({ docs: [] }),
      unique.length
        ? payload.find({
            collection: 'contract-prices',
            where: { and: [{ company: { equals: Number(ctx.company) } }, { sku: { in: unique } }] },
            limit: 1000,
            ...system,
          })
        : Promise.resolve({ docs: [] }),
      payload.find({ collection: 'price-rules', limit: 1000, ...system }),
    ],
  )
  const company = companyRaw as unknown as CompanyDoc
  const settings = settingsRaw as unknown as SettingsDoc
  const products = productsRaw.docs as unknown as ProductDoc[]
  const contracts = contractsRaw.docs as unknown as ContractDoc[]
  const rules = rulesRaw.docs as unknown as RuleDoc[]
  const group = id(company.buyerGroup)
  const groupDoc = (
    group
      ? await payload.findByID({
          collection: 'buyer-groups',
          id: group,
          ...system,
          disableErrors: true,
        })
      : null
  ) as GroupDoc | null
  const listId = id(company.priceList) ?? id(groupDoc?.priceList)
  const list = (
    listId
      ? await payload.findByID({
          collection: 'price-lists',
          id: listId,
          draft: false,
          ...system,
          disableErrors: true,
        })
      : null
  ) as ListDoc | null
  const sellable = brandsSellableIn(windows, ctx.market, ctx.at)

  const pricingProducts = new Map<string, PricingProduct>(
    products
      .filter((p) => p._status === 'published')
      .map((p) => {
        const entry = (p.markets ?? []).find((e) => e.market === ctx.market)
        return [
          p.sku,
          {
            sku: p.sku,
            brand: id(p.brand),
            categories: (p.categories ?? []).map(id).filter((c): c is number => c !== null),
            rrpInclVat: entry?.published ? big(entry.rrpInclVat) : null,
            landedCostAed: big(p.cost),
            // The storefront's sale rule (ADR 0008): published in the market, brand with live rights.
            onSale: publishedIn(p.markets, ctx.market) && sellable.has(String(id(p.brand))),
          },
        ]
      }),
  )
  const fx = Object.fromEntries(
    (settings.fxRates ?? []).map((r) => [r.currency, micros(r.aedPerUnit)]),
  )
  return {
    products: pricingProducts,
    // Checked by the caller: the user's own company's approved, in-date project (system/projects).
    projectPrices: options.projectPrices ?? [],
    contracts: contracts.map((c): ContractPrice => ({
      sku: c.sku,
      price: BigInt(c.price),
      validFrom: date(c.validFrom),
      validTo: date(c.validTo),
    })),
    priceList:
      list && list._status === 'published' && list.market === ctx.market
        ? {
            items: (list.items ?? []).map((i) => ({ sku: i.sku, price: BigInt(i.price) })),
            validFrom: date(list.validFrom),
            validTo: date(list.validTo),
          }
        : null,
    groupDiscounts: (groupDoc?.discounts ?? []).map((d): GroupDiscount => ({
      brand: id(d.brand),
      category: id(d.category),
      bps: d.bps,
    })),
    rules: rules.map((r): PriceRule => ({
      kind: r.kind,
      sku: r.sku ?? null,
      brand: id(r.brand),
      minQty: r.minQty,
      bps: r.bps,
      stackable: Boolean(r.stackable),
      markets: r.markets ?? [],
      validFrom: date(r.validFrom),
      validTo: date(r.validTo),
    })),
    settings: {
      channelFactorBps: {
        dealer: settings.channelFactors?.dealer ?? 7_000,
        integrator: settings.channelFactors?.integrator ?? 7_500,
        retailer: settings.channelFactors?.retailer ?? 8_000,
      },
      targetMarginBps: settings.targetMargin ?? 2_500,
      marginFloorBps: settings.marginFloor ?? 1_000,
      fxAedMicros: fx,
    },
  }
}

/**
 * Trade prices for the signed-in company user's own company. Null when the user is not a
 * company user: nobody else has a trade price, and no caller can name a company.
 */
export async function resolveForSession(
  payload: Payload,
  user: unknown,
  lines: readonly PriceLine[],
  at: Date = new Date(),
  projectPrices?: readonly ProjectPrice[],
): Promise<(ResolvedPrices & { company: CompanyContext['company'] }) | null> {
  const session = await companyContext(payload, user, at)
  if (!session) return null
  const data = await loadPricingData(
    payload,
    session.context,
    lines.map((l) => l.sku),
    { projectPrices },
  )
  return { ...resolvePrices(session.context, lines, data), company: session.company }
}
