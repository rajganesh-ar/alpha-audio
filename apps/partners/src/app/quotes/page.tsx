import type { Metadata } from 'next'
import { formatMoney } from '@alpha/core'
import { Badge } from '@alpha/ui'
import { BoardShell } from '@/components/BoardShell'
import { copy, formatLocale, pageLocale } from '@/lib/locale'
import { QUOTE_TONE, dateTime, quoteState } from '@/lib/orderStatus'
import { storedMoney } from '@/lib/orders'
import { requirePartner } from '@/lib/session'
import type { Quote } from '@/payload-types'

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy(await pageLocale())('partners.quotes.title') }
}

/** The company's quotes, newest first (access scopes them to the company). */
export default async function QuotesPage() {
  const partner = await requirePartner()
  const { account } = partner
  const locale = account.user.locale
  const t = copy(locale)
  const fmt = formatLocale(locale, account.company.market)
  const quotes = await partner.payload.find({
    collection: 'quotes',
    user: partner.user as never, // reason: the signed-in company user from payload.auth
    overrideAccess: false,
    depth: 0,
    sort: '-createdAt',
    limit: 100,
  })

  return (
    <BoardShell partner={partner} current="quotes">
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
          {t('partners.quotes.title')}
        </h1>
        {quotes.docs.length === 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-ink">{t('partners.quotes.empty')}</p>
            <p className="text-base text-ink-muted">{t('partners.quotes.emptyBody')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <caption className="sr-only">{t('partners.quotes.caption')}</caption>
              <thead>
                <tr className="border-b border-line-strong text-sm text-ink-muted">
                  {(
                    [
                      ['partners.quotes.number', 'start'],
                      ['partners.quotes.created', 'start'],
                      ['partners.orders.reference', 'start'],
                      ['partners.quotes.validUntil', 'start'],
                      ['partners.orders.status', 'start'],
                      ['partners.orders.total', 'end'],
                    ] as const
                  ).map(([key, align]) => (
                    <th
                      key={key}
                      scope="col"
                      className={`py-2 pe-4 font-semibold ${align === 'end' ? 'text-end' : 'text-start'}`}
                    >
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(quotes.docs as Quote[]).map((q) => {
                  const gross = storedMoney(q.totals?.gross, q)
                  const state = quoteState(q.status, q.validUntil)
                  return (
                    <tr key={q.id} className="border-b border-line align-top">
                      <th scope="row" className="py-3 pe-4 text-start font-normal">
                        <a
                          href={`/quotes/${q.number}`}
                          className="inline-flex min-h-11 items-center font-mono font-semibold text-ink underline underline-offset-4"
                        >
                          {q.number}
                        </a>
                      </th>
                      <td className="py-3 pe-4 text-ink">
                        {dateTime(q.createdAt, fmt, account.timezone)}
                      </td>
                      <td className="py-3 pe-4 text-ink">{q.reference ?? '—'}</td>
                      <td className="py-3 pe-4 text-ink">
                        {dateTime(q.validUntil, fmt, account.timezone)}
                      </td>
                      <td className="py-3 pe-4">
                        <Badge
                          label={t(`partners.quotes.statuses.${state}`)}
                          tone={QUOTE_TONE[state]}
                        />
                      </td>
                      <td className="py-3 pe-4 text-end font-semibold text-ink tabular-nums">
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
