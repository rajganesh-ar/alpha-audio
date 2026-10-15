import type { Metadata } from 'next'
import { formatMoney, type TraceStep } from '@alpha/core'
import { Badge, Button, EmptyState, OrderSummary, type MessageKey } from '@alpha/ui'
import { BoardShell } from '@/components/BoardShell'
import { LineTrace } from '@/components/LineTrace'
import { Notice } from '@/components/Notice'
import { OrderLines } from '@/components/OrderLines'
import { copy, formatLocale, pageLocale } from '@/lib/locale'
import { QUOTE_TONE, dateTime, quoteState } from '@/lib/orderStatus'
import { reviewQuery, storedMoney } from '@/lib/orders'
import { requirePartner } from '@/lib/session'
import type { Quote } from '@/payload-types'

type Params = Promise<{ number: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

const RESULTS = [
  'withdrawn',
  'not-found',
  'not-open',
  'expired',
  'busy',
  'forbidden',
  'order-refused',
]
const REFUSALS = ['not-allowed', 'on-hold', 'rules', 'unavailable', 'in-progress']

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { number } = await params
  return { title: `${copy(await pageLocale())('partners.quotes.number')} ${number}` }
}

/** One dealer quote: locked lines and trace, validity, held stock, and ordering or withdrawing it. */
export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const partner = await requirePartner()
  const { number } = await params
  const search = await searchParams
  const { account } = partner
  const locale = account.user.locale
  const t = copy(locale)
  const fmt = formatLocale(locale, account.company.market)
  const found = await partner.payload.find({
    collection: 'quotes',
    where: { number: { equals: number } },
    user: partner.user as never, // reason: the signed-in company user from payload.auth
    overrideAccess: false,
    depth: 0,
    limit: 1,
  })
  const quote = found.docs[0] as Quote | undefined
  // Rendered inline, not with notFound(): the board works without JavaScript (see orders page).
  if (!quote)
    return (
      <BoardShell partner={partner} current="quotes">
        <EmptyState
          title={t('notFound.title')}
          body={t('partners.notFound')}
          action={<Button href="/quotes">{t('partners.quotes.back')}</Button>}
        />
      </BoardShell>
    )

  const state = quoteState(quote.status, quote.validUntil)
  const canAct = state === 'open' && ['owner', 'purchaser'].includes(account.user.role)
  const result = typeof search['result'] === 'string' ? search['result'] : null
  const known = result && RESULTS.includes(result) ? result : null
  const refusal =
    typeof search['refusal'] === 'string' && REFUSALS.includes(search['refusal'])
      ? search['refusal']
      : null
  const ctx = {
    t,
    locale: fmt,
    timezone: account.timezone,
    currency: account.currency,
    decimals: account.decimals,
    channel: 'dealer' as const,
  }
  const m = (amount: number | null | undefined) => {
    const value = storedMoney(amount, quote)
    return value ? formatMoney(value, fmt) : undefined
  }
  const lines = quote.lines ?? []
  const review = `/orders/new?${reviewQuery(lines.map((l) => ({ sku: l.sku, qty: l.qty })))}`

  return (
    <BoardShell partner={partner} current="quotes">
      <div className="flex flex-col gap-6">
        <a
          href="/quotes"
          className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4"
        >
          {t('partners.quotes.back')}
        </a>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
            {t('partners.quotes.number')} <bdi className="font-mono">{quote.number}</bdi>
          </h1>
          <Badge label={t(`partners.quotes.statuses.${state}`)} tone={QUOTE_TONE[state]} />
        </div>
        {known ? (
          <Notice tone={known === 'withdrawn' ? 'info' : 'critical'}>
            {t(`partners.quotes.results.${known}` as MessageKey, {
              reason: refusal
                ? t(`partners.order.status.${refusal}` as MessageKey, { skus: '' })
                : '',
            })}
          </Notice>
        ) : null}
        <dl className="grid gap-x-8 gap-y-2 text-base sm:grid-cols-3">
          <div>
            <dt className="text-sm text-ink-muted">{t('partners.quotes.created')}</dt>
            <dd className="text-ink">{dateTime(quote.createdAt, fmt, account.timezone)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{t('partners.quotes.validUntil')}</dt>
            <dd className="text-ink">{dateTime(quote.validUntil, fmt, account.timezone)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{t('partners.orders.reference')}</dt>
            <dd className="text-ink">{quote.reference ?? '—'}</dd>
          </div>
        </dl>
        {state === 'open' ? (
          <p className="text-sm text-ink-muted">
            {t('partners.quotes.lockedNote', {
              date: dateTime(quote.fxLockedAt ?? quote.createdAt, fmt, account.timezone),
              until: dateTime(quote.validUntil, fmt, account.timezone),
            })}
          </p>
        ) : null}
        {quote.orderNumber ? (
          <p className="text-base text-ink">
            {t('partners.quotes.becameOrder', { order: quote.orderNumber })}{' '}
            <a
              href={`/orders/${quote.orderNumber}`}
              className="font-mono text-ink underline underline-offset-4"
            >
              {quote.orderNumber}
            </a>
          </p>
        ) : null}
        {state === 'expired' ? (
          <div className="flex flex-col gap-3">
            <p className="text-base text-ink">{t('partners.quotes.expiredNote')}</p>
            <div>
              <Button href={review} variant="secondary">
                {t('partners.quotes.reviewAgain')}
              </Button>
            </div>
          </div>
        ) : null}

        <OrderLines
          caption={t('partners.quotes.caption')}
          columns={{
            product: t('partners.catalogue.product'),
            qty: t('partners.order.qty'),
            unit: t('partners.order.unit'),
            total: t('partners.order.lineTotal'),
          }}
          lines={lines.map((l) => ({
            sku: l.sku,
            title: l.title,
            qty: l.qty,
            unit: m(l.unitNet),
            total: m(l.lineNet),
            note:
              l.priceStatus === 'needs-approval'
                ? t('partners.catalogue.needsApproval')
                : state === 'open'
                  ? l.held
                    ? t('partners.quotes.held')
                    : t('partners.quotes.notHeld')
                  : undefined,
            critical: l.priceStatus === 'needs-approval',
            trace: (
              <LineTrace trace={Array.isArray(l.trace) ? (l.trace as TraceStep[]) : []} ctx={ctx} />
            ),
          }))}
        />
        <OrderSummary
          title={t('partners.orders.total')}
          rows={[
            { label: t('partners.order.net'), value: m(quote.totals?.net) ?? '' },
            {
              label: t('partners.order.vat', { rate: quote.vatRate }),
              value: m(quote.totals?.vat) ?? '',
              muted: true,
            },
            {
              label: t('partners.order.gross'),
              value: m(quote.totals?.gross) ?? '',
              emphasis: true,
            },
          ]}
        />
        {canAct ? (
          <div className="flex flex-wrap gap-3">
            <form method="post" action={`/api/v1/quotes/${encodeURIComponent(quote.number)}/order`}>
              <Button type="submit" icon="arrow-forward" iconPosition="end">
                {t('partners.quotes.order')}
              </Button>
            </form>
            <form
              method="post"
              action={`/api/v1/quotes/${encodeURIComponent(quote.number)}/withdraw`}
            >
              <Button type="submit" variant="secondary">
                {t('partners.quotes.withdraw')}
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </BoardShell>
  )
}
