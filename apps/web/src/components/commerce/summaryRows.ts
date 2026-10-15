import { formatMoney, type Totals } from '@alpha/core'
import type { SummaryRow, Translate } from '@alpha/ui'

/** Bag and order totals as summary rows: VAT is the per-line share, summed (from core). */
export function summaryRows(t: Translate, totals: Totals, locale: string): SummaryRow[] {
  const fmt = (m: Totals['total']) => formatMoney(m, locale)
  return [
    { label: t('bag.subtotal'), value: fmt(totals.subtotal) },
    {
      label: t('bag.delivery'),
      value: totals.delivery.amount === 0n ? t('bag.deliveryFree') : fmt(totals.delivery),
    },
    { label: t('bag.total'), value: fmt(totals.total), emphasis: true },
    { label: t('bag.vatIncluded'), value: fmt(totals.vat), muted: true },
  ]
}
