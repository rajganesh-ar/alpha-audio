import type { Id } from '../ledger/types'
import type { CurrencyCode, CurrencyDecimals, Money } from '../money'

/** Trade channels (spec: Companies.channel); each has its own factor on RRP excl. VAT. */
export const CHANNELS = ['dealer', 'integrator', 'retailer'] as const
export type Channel = (typeof CHANNELS)[number]

export const STOCK_VISIBILITIES = ['exact', 'banded', 'hidden'] as const
export type StockVisibility = (typeof STOCK_VISIBILITIES)[number]

/** Basis points: 10,000 bp = 100 %. */
export type Bps = number

/**
 * Who is buying, where and when. Built from the signed-in company user's session (CLAUDE.md
 * rule 3), never from request parameters.
 */
export interface PriceContext {
  company: Id
  market: string
  currency: CurrencyCode
  decimals: CurrencyDecimals
  /** The market's VAT rate in percent (added on top of trade prices). */
  vatRate: number
  channel: Channel
  at: Date
}

export interface PricingProduct {
  sku: string
  brand: Id | null
  categories: readonly Id[]
  /** RRP incl. VAT in the market, minor units; null when not priced there. */
  rrpInclVat: bigint | null
  /** Landed unit cost, AED fils; null when unknown. Never leaves the server. */
  landedCostAed: bigint | null
  /** Published in the market and the brand holds live rights there (ADR 0008). */
  onSale: boolean
}

export interface Validity {
  validFrom: Date | null
  validTo: Date | null
}

export interface ContractPrice extends Validity {
  sku: string
  /** Net (VAT-exclusive) unit price, market minor units. */
  price: bigint
}

/** A project price granted on an approved registration (docs/tasks/0017): net, market minor units. */
export interface ProjectPrice {
  sku: string
  price: bigint
}

export interface PriceListItem {
  sku: string
  price: bigint
}

export interface GroupDiscount {
  brand: Id | null
  category: Id | null
  bps: Bps
}

export interface PriceRule extends Validity {
  kind: 'volume' | 'promotion'
  sku: string | null
  brand: Id | null
  minQty: number
  bps: Bps
  /** Promotions only: applies after any base price, contracts included. */
  stackable: boolean
  markets: readonly string[]
}

export interface PricingSettings {
  channelFactorBps: Record<Channel, Bps>
  /** Target margin over landed cost for products with no RRP. */
  targetMarginBps: Bps
  /** Below `landedCost ÷ (1 − floor)` a price needs approval. */
  marginFloorBps: Bps
  /** AED per one unit of each currency, in micro-AED (AED itself is 1,000,000). */
  fxAedMicros: Readonly<Record<string, bigint>>
}

/** Everything the engine reads for one company and a set of SKUs (loaded by the system store). */
export interface PricingData {
  products: ReadonlyMap<string, PricingProduct>
  contracts: readonly ContractPrice[]
  /** Prices of the project the order or quote is for (approved, in date); empty otherwise. */
  projectPrices?: readonly ProjectPrice[] | undefined
  /** The company's price list (or its buyer group's), already chosen for the market. */
  priceList: ({ items: readonly PriceListItem[] } & Validity) | null
  groupDiscounts: readonly GroupDiscount[]
  rules: readonly PriceRule[]
  settings: PricingSettings
}

export interface PriceLine {
  sku: string
  qty: number
}

export const PRICE_RULES = [
  'contract',
  'project',
  'price-list',
  'dealer-list',
  'group-discount',
  'volume-break',
  'promotion',
  'margin-floor',
] as const
export type PriceRuleName = (typeof PRICE_RULES)[number]

export interface TraceStep {
  rule: PriceRuleName
  /** The engine looked at this rule (later base rules are not looked at once one matched). */
  seen: boolean
  matched: boolean
  /** What the rule gave, e.g. `1250.00` or `-7.5%`; null when it did not match. */
  value: string | null
}

export type PriceStatus = 'ok' | 'needs-approval' | 'unavailable'

export interface ResolvedLine {
  sku: string
  qty: number
  status: PriceStatus
  /** Net unit price. Null when unavailable. */
  unit: Money | null
  total: Money | null
  vat: Money | null
  basis: Exclude<
    PriceRuleName,
    'group-discount' | 'volume-break' | 'promotion' | 'margin-floor'
  > | null
  trace: TraceStep[]
}

export interface ResolvedPrices {
  lines: ResolvedLine[]
  totals: { net: Money; vat: Money; gross: Money }
}
