import type { Metadata } from 'next'
import { formatMoney, type Approval, type TraceStep } from '@alpha/core'
import { Badge, Button, EmptyState, OrderSummary, type MessageKey } from '@alpha/ui'
import { BoardShell } from '@/components/BoardShell'
import { LineTrace } from '@/components/LineTrace'
import { Notice } from '@/components/Notice'
import { OrderLines } from '@/components/OrderLines'
import { copy, formatLocale, pageLocale } from '@/lib/locale'
import { STATUS_TONE, dateTime } from '@/lib/orderStatus'
import { storedMoney } from '@/lib/orders'
import { requirePartner } from '@/lib/session'
import type { TradeOrder } from '@/payload-types'

type Params = Promise<{ number: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

const DECISIONS = [
  'approved',
  'rejected',
  'cancelled',
  'forbidden',
  'not-pending',
  'nothing-to-decide',
  'busy',
  'not-found',
  'error',
]

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { number } = await params
  return { title: `${copy(await pageLocale())('partners.orders.number')} ${number}` }
}

interface StoredApproval {
  kind: Approval['kind']
  reason: Approval['reason']
  status: Approval['status']
  by: number | null
  at: string | null
  note: string | null
}

/** One dealer order: lines, totals, approvals and what the signed-in user may do with it. */
export default async function OrderPage({
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
    collection: 'trade-orders',
    where: { number: { equals: number } },
    user: partner.user as never, // reason: the signed-in company user from payload.auth
    overrideAccess: false,
    depth: 1,
    limit: 1,
  })
  const order = found.docs[0] as TradeOrder | undefined
  // Rendered here rather than with notFound(): Next streams the not-found boundary in a way that
  // needs JavaScript to show, and the board must work without it. Another company's order is
  // indistinguishable from one that does not exist.
  if (!order)
    return (
      <BoardShell partner={partner} current="orders">
        <EmptyState
          title={t('notFound.title')}
          body={t('partners.notFound')}
          action={<Button href="/orders">{t('partners.orders.back')}</Button>}
        />
      </BoardShell>
    )

  const approvals = (Array.isArray(order.approvals) ? order.approvals : []) as StoredApproval[]
  const pending = order.status === 'pending-approval'
  const placedBy = typeof order.placedBy === 'object' ? order.placedBy : null
  const isOwner = account.user.role === 'owner'
  const isPlacer = placedBy?.id === account.user.id
  const canDecide =
    pending && isOwner && approvals.some((a) => a.kind === 'company' && a.status === 'pending')
  const canCancel = pending && (isOwner || isPlacer)
  const decision = typeof search['decision'] === 'string' ? search['decision'] : null
  const known = decision && DECISIONS.includes(decision) ? decision : null
  const good = known === 'approved' || known === 'rejected' || known === 'cancelled'
  const ctx = {
    t,
    locale: fmt,
    timezone: account.timezone,
    currency: account.currency,
    decimals: account.decimals,
    channel: 'dealer' as const,
  }
  const m = (amount: number | null | undefined) => {
    const value = storedMoney(amount, order)
    return value ? formatMoney(value, fmt) : undefined
  }

  return (
    <BoardShell partner={partner} current="orders">
      <div className="flex flex-col gap-6">
        <a
          href="/orders"
          className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4"
        >
          {t('partners.orders.back')}
        </a>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
            {t('partners.orders.number')} <bdi className="font-mono">{order.number}</bdi>
          </h1>
          <Badge
            label={t(`partners.orders.statuses.${order.status}`)}
            tone={STATUS_TONE[order.status]}
          />
        </div>
        {known ? (
          <Notice tone={good ? 'info' : 'critical'}>
            {t(`partners.orders.decision.${known}` as MessageKey)}
          </Notice>
        ) : null}
        <dl className="grid gap-x-8 gap-y-2 text-base sm:grid-cols-3">
          <div>
            <dt className="text-sm text-ink-muted">{t('partners.orders.placed')}</dt>
            <dd className="text-ink">{dateTime(order.createdAt, fmt, account.timezone)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{t('partners.orders.placedBy')}</dt>
            <dd className="text-ink">{placedBy ? (placedBy.name ?? placedBy.email) : '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{t('partners.orders.reference')}</dt>
            <dd className="text-ink">{order.poNumber ?? '—'}</dd>
          </div>
        </dl>
        {order.note ? <p className="text-base text-ink">{order.note}</p> : null}
        {pending && order.holdExpiresAt ? (
          <p className="text-sm text-ink-muted">
            {t('partners.orders.heldUntil', {
              date: dateTime(order.holdExpiresAt, fmt, account.timezone),
            })}
          </p>
        ) : null}
        {order.closedReason ? (
          <p className="text-sm text-ink">
            {t('partners.orders.closedReason', { reason: order.closedReason })}
          </p>
        ) : null}

        <OrderLines
          caption={t('partners.orders.caption')}
          columns={{
            product: t('partners.catalogue.product'),
            qty: t('partners.order.qty'),
            unit: t('partners.order.unit'),
            total: t('partners.order.lineTotal'),
          }}
          lines={(order.lines ?? []).map((l) => ({
            sku: l.sku,
            title: l.title,
            qty: l.qty,
            unit: m(l.unitNet),
            total: m(l.lineNet),
            note:
              l.priceStatus === 'needs-approval'
                ? t('partners.catalogue.needsApproval')
                : undefined,
            critical: l.priceStatus === 'needs-approval',
            trace: (
              <LineTrace trace={Array.isArray(l.trace) ? (l.trace as TraceStep[]) : []} ctx={ctx} />
            ),
          }))}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="approvals" className="flex flex-col gap-3">
            <h2 id="approvals" className="text-lg font-semibold text-ink">
              {t('partners.orders.approvals')}
            </h2>
            {approvals.length === 0 ? (
              <p className="text-base text-ink-muted">{t('partners.order.noApprovals')}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {approvals.map((a) => (
                  <li key={`${a.kind}-${a.reason}`} className="flex flex-wrap items-center gap-2">
                    <Badge
                      label={t(`partners.orders.approvalStates.${a.status}`)}
                      tone={
                        a.status === 'approved'
                          ? 'positive'
                          : a.status === 'rejected'
                            ? 'critical'
                            : 'caution'
                      }
                    />
                    <span className="text-ink">
                      {t(`partners.orders.approval.${a.kind}`)}:{' '}
                      {t(`partners.orders.reasons.${a.reason}`)}
                    </span>
                    {a.at ? (
                      <span className="text-sm text-ink-muted">
                        {dateTime(a.at, fmt, account.timezone)}
                        {a.note ? ` · ${a.note}` : ''}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <OrderSummary
            title={t('partners.orders.total')}
            rows={[
              { label: t('partners.order.net'), value: m(order.totals?.net) ?? '' },
              {
                label: t('partners.order.vat', { rate: order.vatRate }),
                value: m(order.totals?.vat) ?? '',
                muted: true,
              },
              {
                label: t('partners.order.gross'),
                value: m(order.totals?.gross) ?? '',
                emphasis: true,
              },
            ]}
          />
        </div>

        {canDecide || canCancel ? (
          <form
            method="post"
            action={`/api/v1/orders/${encodeURIComponent(order.number)}/decide`}
            className="flex flex-col gap-4 rounded-card border border-line p-4"
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-ink">{t('partners.orders.reason')}</span>
              <textarea
                name="reason"
                maxLength={500}
                rows={2}
                className="w-full rounded-control border border-line-strong bg-transparent px-3 py-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              {canDecide ? (
                <>
                  <Button type="submit" name="decision" value="approve" icon="check">
                    {t('partners.orders.approve')}
                  </Button>
                  <Button
                    type="submit"
                    variant="secondary"
                    tone="critical"
                    name="decision"
                    value="reject"
                  >
                    {t('partners.orders.reject')}
                  </Button>
                </>
              ) : null}
              {canCancel ? (
                <Button type="submit" variant="secondary" name="decision" value="cancel">
                  {t('partners.orders.cancel')}
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </BoardShell>
  )
}
