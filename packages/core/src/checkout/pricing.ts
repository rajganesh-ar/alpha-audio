import { money, vatShare, type Money } from '../money'
import type { ConsumerPrice, PricingMarket } from '../catalog/consumerPrice'

/** Most units of one product in a bag (a guard against typos and stock griefing). */
export const MAX_LINE_QTY = 10
/** Most distinct products in a bag. */
export const MAX_BAG_LINES = 20

export interface BagItem {
  sku: string
  qty: number
}

/** What the catalogue says about a SKU in the market right now. */
export interface CatalogEntry {
  sku: string
  productId: string | number
  title: string
  price: ConsumerPrice
  /** The sale rule: published in the market and the brand holds live rights (ADR 0008). */
  onSale: boolean
}

export type LineProblem = 'not-on-sale' | 'price-on-request' | 'invalid-quantity'

export interface PricedLine {
  sku: string
  productId: string | number
  title: string
  qty: number
  unitPrice: Money
  lineTotal: Money
  /** VAT contained in the line total. */
  vat: Money
}

export interface Totals {
  /** Lines incl. VAT. */
  subtotal: Money
  /** Sum of the per-line VAT shares (never computed on the total; spec: GCC market layer → Money). */
  vat: Money
  /** Free while shipping zones are not modelled (shipping zones task). */
  delivery: Money
  total: Money
}

export interface PricedBag {
  lines: PricedLine[]
  problems: Array<{ sku: string; problem: LineProblem }>
  totals: Totals
}

const whole = (n: number) => Number.isSafeInteger(n)

/**
 * Prices a bag in a market from the catalogue, now. Lines that cannot be bought (not on sale,
 * price on request, bad quantity) are reported, not priced; nothing is ever priced from what the
 * client sent.
 */
export function priceBag(
  items: readonly BagItem[],
  lookup: (sku: string) => CatalogEntry | undefined,
  market: PricingMarket,
): PricedBag {
  const zero = (): Money => money(0, market.currency, market.decimals)
  const lines: PricedLine[] = []
  const problems: PricedBag['problems'] = []
  for (const item of items) {
    if (!whole(item.qty) || item.qty < 1 || item.qty > MAX_LINE_QTY) {
      problems.push({ sku: item.sku, problem: 'invalid-quantity' })
      continue
    }
    const entry = lookup(item.sku)
    if (!entry || !entry.onSale || entry.price.kind === 'unavailable') {
      problems.push({ sku: item.sku, problem: 'not-on-sale' })
      continue
    }
    if (entry.price.kind === 'request') {
      problems.push({ sku: item.sku, problem: 'price-on-request' })
      continue
    }
    const unit = entry.price.price
    const lineAmount = unit.amount * BigInt(item.qty)
    lines.push({
      sku: entry.sku,
      productId: entry.productId,
      title: entry.title,
      qty: item.qty,
      unitPrice: unit,
      lineTotal: { ...unit, amount: lineAmount },
      vat: { ...unit, amount: vatShare(lineAmount, market.vatRate) },
    })
  }
  const sum = (pick: (l: PricedLine) => Money) =>
    lines.reduce((acc, l) => ({ ...acc, amount: acc.amount + pick(l).amount }), zero())
  const subtotal = sum((l) => l.lineTotal)
  const delivery = zero()
  return {
    lines,
    problems,
    totals: {
      subtotal,
      vat: sum((l) => l.vat),
      delivery,
      total: { ...subtotal, amount: subtotal.amount + delivery.amount },
    },
  }
}

/** Adds, sets or removes a line, merging duplicates and capping the bag. Pure. */
export function updateBag(
  items: readonly BagItem[],
  change: { sku: string; qty: number; mode: 'add' | 'set' },
): BagItem[] {
  const current = items.find((i) => i.sku === change.sku)?.qty ?? 0
  const qty = Math.max(
    0,
    Math.min(MAX_LINE_QTY, change.mode === 'add' ? current + change.qty : change.qty),
  )
  const rest = items.filter((i) => i.sku !== change.sku)
  if (qty === 0) return rest
  if (!current && rest.length >= MAX_BAG_LINES) return [...items]
  const next = [...items.map((i) => (i.sku === change.sku ? { sku: i.sku, qty } : i))]
  return current ? next : [...rest, { sku: change.sku, qty }]
}
