import {
  formatMoney,
  money,
  type CurrencyCode,
  type CurrencyDecimals,
  type Money,
  type RuleCheck,
} from '@alpha/core'
import type { OrderDraftLine } from '@alpha/payload'
import type { Translate } from '@alpha/ui'

/**
 * Helpers for the dealer order pages (docs/tasks/0015): reading the lines a form or URL carries,
 * and putting the service's outcome into words. Pure, so they are unit tested.
 */

export const MAX_FORM_LINES = 200

/** Pairs `sku` and `qty` values (repeated form fields or query parameters) into draft lines. */
export function draftLines(skus: readonly string[], qtys: readonly string[]): OrderDraftLine[] {
  const lines: OrderDraftLine[] = []
  for (const [i, raw] of skus.slice(0, MAX_FORM_LINES).entries()) {
    const sku = raw.trim().slice(0, 64)
    if (!sku) continue
    const text = (qtys[i] ?? '').trim()
    const qty = /^\d{1,6}$/.test(text) ? Number(text) : text === '' ? 1 : 0
    lines.push({ sku, qty })
  }
  return lines
}

/** The query string that reopens the review with these lines. */
export function reviewQuery(lines: readonly OrderDraftLine[], extra: Record<string, string> = {}) {
  const params = new URLSearchParams()
  for (const l of lines) {
    params.append('sku', l.sku)
    params.append('qty', String(l.qty))
  }
  for (const [k, v] of Object.entries(extra)) params.set(k, v)
  return params.toString()
}

/** Each line's problem in words, by SKU, and the order-level problems. */
export function problemText(
  problems: RuleCheck,
  t: Translate,
  locale: string,
): { lines: Map<string, string>; order: string[] } {
  const lines = new Map<string, string>()
  for (const p of problems.lines)
    lines.set(
      p.sku,
      p.problem === 'multiple'
        ? t('partners.order.problems.multiple', { multiple: p.multiple })
        : t(`partners.order.problems.${p.problem}`),
    )
  const order = problems.order.map((p) =>
    p.problem === 'minimum-value'
      ? t('partners.order.problems.minimum-value', { amount: formatMoney(p.minimum, locale) })
      : p.problem === 'too-many-lines'
        ? t('partners.order.problems.too-many-lines', { max: p.max })
        : t('partners.order.problems.empty'),
  )
  return { lines, order }
}

/** Money stored on an order document (minor units, with the order's currency and decimals). */
export function storedMoney(
  amount: number | null | undefined,
  order: { currency: string; decimals: number },
): Money | null {
  return typeof amount === 'number'
    ? money(BigInt(amount), order.currency as CurrencyCode, order.decimals as CurrencyDecimals)
    : null
}

/** The share of the limit in use for the credit meter; null without a credit line. */
export function creditRatio(credit: { limit: Money | null; used: Money } | null): number | null {
  if (!credit?.limit) return null
  if (credit.limit.amount <= 0n) return credit.used.amount > 0n ? 1 : 0
  return Number((credit.used.amount * 10_000n) / credit.limit.amount) / 10_000
}
