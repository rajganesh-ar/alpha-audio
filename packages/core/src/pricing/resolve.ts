import { divideRoundHalfUp, money, toDecimalString, vatOnNet, type Money } from '../money'
import type {
  Bps,
  PriceContext,
  PriceLine,
  PriceRule,
  PriceRuleName,
  PricingData,
  PricingProduct,
  ResolvedLine,
  ResolvedPrices,
  StockVisibility,
  TraceStep,
  Validity,
} from './types'

const FULL: Bps = 10_000
const AED_MICROS = 1_000_000n

const live = (v: Validity, at: Date) =>
  (!v.validFrom || v.validFrom.getTime() <= at.getTime()) &&
  (!v.validTo || at.getTime() < v.validTo.getTime())
const applyBps = (amount: bigint, bps: Bps) =>
  divideRoundHalfUp(amount * BigInt(FULL - bps), BigInt(FULL))
const pct = (bps: Bps) => `${bps > 0 ? '-' : '+'}${Math.abs(bps) / 100}%`

/** RRP incl. VAT → net: `rrp − rrp × rate ÷ (100 + rate)`, half up. */
function netOfVat(inclusive: bigint, ratePercent: number): bigint {
  const bp = BigInt(Math.round(ratePercent * 100))
  return inclusive - divideRoundHalfUp(inclusive * bp, 10_000n + bp)
}

/** Landed cost (AED fils) in the market currency's minor units at the configured rate. */
function landedInCurrency(
  product: PricingProduct,
  ctx: PriceContext,
  data: PricingData,
): bigint | null {
  if (product.landedCostAed === null) return null
  const fx = ctx.currency === 'AED' ? AED_MICROS : data.settings.fxAedMicros[ctx.currency]
  if (!fx || fx <= 0n) return null
  // fils → AED (÷100) → micro-AED (×1e6) → currency units (÷fx) → minor (×10^decimals)
  return divideRoundHalfUp(
    product.landedCostAed * AED_MICROS * 10n ** BigInt(ctx.decimals),
    100n * fx,
  )
}

function bestRule(
  rules: readonly PriceRule[],
  kind: PriceRule['kind'],
  product: PricingProduct,
  qty: number,
  ctx: PriceContext,
  stackable?: boolean,
) {
  return rules
    .filter(
      (r) =>
        r.kind === kind &&
        (stackable === undefined || r.stackable === stackable) &&
        live(r, ctx.at) &&
        (r.markets.length === 0 || r.markets.includes(ctx.market)) &&
        qty >= r.minQty &&
        (r.sku
          ? r.sku === product.sku
          : r.brand !== null
            ? String(r.brand) === String(product.brand)
            : true),
    )
    .sort((a, b) => b.bps - a.bps)[0]
}

/**
 * Trade prices for a company (spec: Server logic → Price engine; docs/tasks/0013). Pure: the
 * caller loads `data` for this company only. The base price is the first match of contract,
 * project (not yet modelled), price list, then dealer list (RRP excl. VAT × channel factor, or
 * landed cost ÷ (1 − target margin)). A dealer-list base takes the group discount, the best
 * volume break and a non-stackable promotion; a stackable promotion applies to any base. Units
 * below the margin floor need approval. Prices are net; VAT is added on top per line.
 */
export function resolvePrices(
  ctx: PriceContext,
  lines: readonly PriceLine[],
  data: PricingData,
): ResolvedPrices {
  const m = (amount: bigint): Money => money(amount, ctx.currency, ctx.decimals)
  const fmt = (amount: bigint) => toDecimalString(amount, ctx.decimals)
  const resolved = lines.map((line): ResolvedLine => {
    const trace: TraceStep[] = []
    const step = (
      rule: PriceRuleName,
      seen: boolean,
      matched: boolean,
      value: string | null = null,
    ) => trace.push({ rule, seen, matched, value })
    const product = data.products.get(line.sku)
    const unavailable = (): ResolvedLine => ({
      sku: line.sku,
      qty: line.qty,
      status: 'unavailable',
      unit: null,
      total: null,
      vat: null,
      basis: null,
      trace,
    })
    if (!product || !product.onSale || !Number.isSafeInteger(line.qty) || line.qty < 1)
      return unavailable()

    let base: bigint | null = null
    let basis: ResolvedLine['basis'] = null
    const contract = data.contracts
      .filter((c) => c.sku === product.sku && live(c, ctx.at))
      .sort((a, b) => Number(a.price - b.price))[0]
    step('contract', true, Boolean(contract), contract ? fmt(contract.price) : null)
    if (contract) [base, basis] = [contract.price, 'contract']
    step('project', base === null, false)
    const listed =
      base === null && data.priceList && live(data.priceList, ctx.at)
        ? data.priceList.items.find((i) => i.sku === product.sku)
        : undefined
    step('price-list', base === null, Boolean(listed), listed ? fmt(listed.price) : null)
    if (base === null && listed) [base, basis] = [listed.price, 'price-list']

    if (base === null) {
      const landed = landedInCurrency(product, ctx, data)
      const fromRrp =
        product.rrpInclVat !== null
          ? divideRoundHalfUp(
              netOfVat(product.rrpInclVat, ctx.vatRate) *
                BigInt(data.settings.channelFactorBps[ctx.channel]),
              BigInt(FULL),
            )
          : null
      const fromCost =
        fromRrp === null && landed !== null
          ? divideRoundHalfUp(landed * BigInt(FULL), BigInt(FULL - data.settings.targetMarginBps))
          : null
      const list = fromRrp ?? fromCost
      step('dealer-list', true, list !== null, list !== null ? fmt(list) : null)
      if (list === null) return unavailable()
      ;[base, basis] = [list, 'dealer-list']
    } else {
      step('dealer-list', false, false)
    }

    let unit = base
    const listBased = basis === 'dealer-list'
    const discount = listBased
      ? (data.groupDiscounts.find(
          (d) => d.brand !== null && String(d.brand) === String(product.brand),
        ) ??
        data.groupDiscounts.find(
          (d) =>
            d.category !== null && product.categories.some((c) => String(c) === String(d.category)),
        ) ??
        data.groupDiscounts.find((d) => d.brand === null && d.category === null))
      : undefined
    step('group-discount', listBased, Boolean(discount), discount ? pct(discount.bps) : null)
    if (discount) unit = applyBps(unit, discount.bps)
    const volume = listBased ? bestRule(data.rules, 'volume', product, line.qty, ctx) : undefined
    step('volume-break', listBased, Boolean(volume), volume ? pct(volume.bps) : null)
    if (volume) unit = applyBps(unit, volume.bps)
    const promotion =
      bestRule(data.rules, 'promotion', product, line.qty, ctx, true) ??
      (listBased ? bestRule(data.rules, 'promotion', product, line.qty, ctx, false) : undefined)
    step('promotion', true, Boolean(promotion), promotion ? pct(promotion.bps) : null)
    if (promotion) unit = applyBps(unit, promotion.bps)

    const landed = landedInCurrency(product, ctx, data)
    const floor =
      landed !== null
        ? divideRoundHalfUp(landed * BigInt(FULL), BigInt(FULL - data.settings.marginFloorBps))
        : null
    const belowFloor = floor !== null && unit < floor
    step('margin-floor', floor !== null, belowFloor, belowFloor ? 'below floor' : null)

    const total = unit * BigInt(line.qty)
    return {
      sku: line.sku,
      qty: line.qty,
      status: belowFloor ? 'needs-approval' : 'ok',
      unit: m(unit),
      total: m(total),
      vat: m(vatOnNet(total, ctx.vatRate)),
      basis,
      trace,
    }
  })
  const sum = (pick: (l: ResolvedLine) => Money | null) =>
    resolved.reduce((acc, l) => acc + (pick(l)?.amount ?? 0n), 0n)
  const net = sum((l) => l.total)
  const vat = sum((l) => l.vat)
  return { lines: resolved, totals: { net: m(net), vat: m(vat), gross: m(net + vat) } }
}

/** What a company may see of stock (spec: dealer board rules): exact, banded, or nothing. */
export function stockBand(units: number, visibility: StockVisibility): string | null {
  if (visibility === 'hidden') return null
  if (visibility === 'exact') return String(Math.max(0, units))
  if (units >= 10) return '10+'
  if (units >= 3) return '3–9'
  if (units >= 1) return 'Low'
  return '0'
}

/**
 * The lowest RRP (incl. VAT) a product may carry in a market: its minimum advertised price excl.
 * VAT plus VAT on it (spec: storefront price cannot go below `mapExclVat × (1 + vat)`).
 */
export function minimumRrp(mapExclVat: bigint, vatRate: number): bigint {
  return mapExclVat + vatOnNet(mapExclVat, vatRate)
}
