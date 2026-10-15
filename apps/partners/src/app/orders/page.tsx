import type { Metadata } from 'next'
import { formatMoney } from '@alpha/core'
import { tradeCredit } from '@alpha/payload'
import { Badge, Button } from '@alpha/ui'
import { BoardShell } from '@/components/BoardShell'
import { Credit } from '@/components/Credit'
import { copy, formatLocale, pageLocale } from '@/lib/locale'
import { STATUS_TONE, dateTime } from '@/lib/orderStatus'
import { storedMoney } from '@/lib/orders'
import { requirePartner } from '@/lib/session'
import type { TradeOrder } from '@/payload-types'

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy(await pageLocale())('partners.orders.title') }
}

/** The company's dealer orders, newest first (access scopes them to the company). */
export default async function OrdersPage() {
  const partner = await requirePartner()
  const { account } = partner
  const locale = account.user.locale
  const t = copy(locale)
  const fmt = formatLocale(locale, account.company.market)
  const [orders, credit] = await Promise.all([
    partner.payload.find({
      collection: 'trade-orders',
      user: partner.user as never, // reason: the signed-in company user from payload.auth
      overrideAccess: false,
      depth: 1,
      sort: '-createdAt',
      limit: 100,
    }),
    tradeCredit(partner.payload, partner.user),
  ])
  const canOrder = ['owner', 'purchaser'].includes(account.user.role) && !account.hold

  return (
    <BoardShell partner={partner} current="orders">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
            {t('partners.orders.title')}
          </h1>
          {canOrder ? (
            <Button href="/orders/new" icon="arrow-forward" iconPosition="end">
              {t('partners.nav.newOrder')}
            </Button>
          ) : null}
        </div>
        {credit ? <Credit credit={credit} t={t} locale={fmt} /> : null}
        {orders.docs.length === 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-ink">{t('partners.orders.empty')}</p>
            <p className="text-base text-ink-muted">{t('partners.orders.emptyBody')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <caption className="sr-only">{t('partners.orders.caption')}</caption>
              <thead>
                <tr className="border-b border-line-strong text-sm text-ink-muted">
                  <th scope="col" className="py-2 pe-4 text-start font-semibold">
                    {t('partners.orders.number')}
                  </th>
                  <th scope="col" className="py-2 pe-4 text-start font-semibold">
                    {t('partners.orders.placed')}
                  </th>
                  <th scope="col" className="py-2 pe-4 text-start font-semibold">
                    {t('partners.orders.reference')}
                  </th>
                  <th scope="col" className="py-2 pe-4 text-start font-semibold">
                    {t('partners.orders.status')}
                  </th>
                  <th scope="col" className="py-2 text-end font-semibold">
                    {t('partners.orders.total')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(orders.docs as TradeOrder[]).map((o) => {
                  const gross = storedMoney(o.totals?.gross, o)
                  const by = typeof o.placedBy === 'object' ? o.placedBy : null
                  return (
                    <tr key={o.id} className="border-b border-line align-top">
                      <th scope="row" className="py-3 pe-4 text-start font-normal">
                        <a
                          href={`/orders/${o.number}`}
                          className="inline-flex min-h-11 items-center font-mono font-semibold text-ink underline underline-offset-4"
                        >
                          {o.number}
                        </a>
                      </th>
                      <td className="py-3 pe-4 text-ink">
                        <span className="block">
                          {dateTime(o.createdAt, fmt, account.timezone)}
                        </span>
                        {by ? (
                          <span className="block text-sm text-ink-muted">
                            {by.name ?? by.email}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pe-4 text-ink">{o.poNumber ?? '—'}</td>
                      <td className="py-3 pe-4">
                        <Badge
                          label={t(`partners.orders.statuses.${o.status}`)}
                          tone={STATUS_TONE[o.status]}
                        />
                      </td>
                      <td className="py-3 text-end font-semibold text-ink tabular-nums">
                        {gross ? <bdi>{formatMoney(gross, fmt)}</bdi> : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BoardShell>
  )
}
