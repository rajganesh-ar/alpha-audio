import { formatMoney, type CreditPosition } from '@alpha/core'
import { CreditMeter, type Translate } from '@alpha/ui'
import { creditRatio } from '@/lib/orders'

/** The company's credit meter, in words and as a bar. */
export function Credit({
  credit,
  t,
  locale,
}: {
  credit: CreditPosition
  t: Translate
  locale: string
}) {
  const f = (m: NonNullable<CreditPosition['limit']>) => formatMoney(m, locale)
  return (
    <CreditMeter
      label={t('partners.creditMeter.label')}
      ratio={creditRatio(credit)}
      summary={
        credit.limit
          ? t('partners.creditMeter.summary', { used: f(credit.used), limit: f(credit.limit) })
          : undefined
      }
      available={
        credit.available
          ? t('partners.creditMeter.available', { amount: f(credit.available) })
          : undefined
      }
      emptyLabel={t('partners.creditMeter.none')}
    />
  )
}
