import type { Metadata } from 'next'
import {
  formatMoney,
  money,
  type Approval,
  type CurrencyCode,
  type CurrencyDecimals,
} from '@alpha/core'
import { Button, EmptyState, type MessageKey } from '@alpha/ui'
import { getMarketsCached } from '@alpha/payload'
import type { TradeOrder } from '@/payload-types'
import { loginPath, opsCopy, opsDate, staffSession } from '@/lib/ops'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Dealer approvals' }

const RESULTS = [
  'approved',
  'rejected',
  'not-found',
  'not-pending',
  'nothing-to-decide',
  'busy',
  'forbidden',
]

/**
 * Dealer orders waiting for Alpha (docs/tasks/0015): over the credit limit or with a price
 * below the margin floor. Oldest first. Staff only; read as the staff user (access applies).
 */
export default async function OpsTradeOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const t = opsCopy()
  const { payload, user } = await staffSession()
  if (!user) {
    return (
      <EmptyState
        title={t('ops.signIn')}
        icon="user"
        action={<Button href={loginPath('/ops/trade-orders/')}>{t('ops.signInAction')}</Button>}
      />
    )
  }
  const search = await searchParams
  const result = typeof search['result'] === 'string' ? search['result'] : null
  const { docs } = await payload.find({
    collection: 'trade-orders',
    where: { status: { equals: 'pending-approval' } },
    sort: 'createdAt',
    limit: 200,
    depth: 1,
    user,
    overrideAccess: false,
  })
  const waiting = (docs as TradeOrder[]).filter((o) =>
    ((o.approvals ?? []) as Approval[]).some((a) => a.kind === 'alpha' && a.status === 'pending'),
  )
  const zones = new Map((await getMarketsCached(payload)).map((m) => [m.code, m.timezone]))
  const amount = (o: TradeOrder, n: number | null | undefined) =>
    formatMoney(
      money(n ?? 0, o.currency as CurrencyCode, o.decimals as CurrencyDecimals),
      `en-${o.market.toUpperCase()}`,
    )

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold text-ink">{t('ops.trade.title')}</h1>
      {result && RESULTS.includes(result) ? (
        <p role="status" className="rounded-card border border-line-strong px-4 py-3 text-ink">
          {t(`ops.trade.results.${result}` as MessageKey, {
            order: typeof search['order'] === 'string' ? search['order'] : '',
          })}
        </p>
      ) : null}
      {waiting.length === 0 ? (
        <EmptyState title={t('ops.trade.empty')} icon="check" />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-6 p-0">
          {waiting.map((o) => {
            const company = typeof o.company === 'object' ? o.company : null
            const reasons = ((o.approvals ?? []) as Approval[]).filter(
              (a) => a.kind === 'alpha' && a.status === 'pending',
            )
            return (
              <li key={o.id} className="flex flex-col gap-3 rounded-card border border-line p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-mono text-lg font-semibold text-ink">{o.number}</h2>
                  <span className="text-ink tabular-nums">{amount(o, o.totals?.gross)}</span>
                </div>
                <p className="text-ink">
                  {company?.name ?? ''} · {opsDate(o.createdAt, zones.get(o.market) ?? 'UTC')}
                  {o.poNumber ? ` · ${o.poNumber}` : ''}
                </p>
                <ul className="m-0 list-disc ps-6 text-ink">
                  {reasons.map((a) => (
                    <li key={a.reason}>{t(`ops.trade.reasons.${a.reason}`)}</li>
                  ))}
                </ul>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line-strong text-ink-muted">
                      <th scope="col" className="py-1 pe-4 text-start font-semibold">
                        {t('ops.sku')}
                      </th>
                      <th scope="col" className="py-1 pe-4 text-end font-semibold">
                        {t('ops.qty')}
                      </th>
                      <th scope="col" className="py-1 pe-4 text-end font-semibold">
                        {t('ops.trade.unit')}
                      </th>
                      <th scope="col" className="py-1 text-start font-semibold">
                        {t('ops.trade.price')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(o.lines ?? []).map((l) => (
                      <tr key={l.id ?? l.sku} className="border-b border-line">
                        <td className="py-1 pe-4 font-mono text-ink">{l.sku}</td>
                        <td className="py-1 pe-4 text-end text-ink tabular-nums">{l.qty}</td>
                        <td className="py-1 pe-4 text-end text-ink tabular-nums">
                          {amount(o, l.unitNet)}
                        </td>
                        <td className="py-1 text-ink">
                          {l.priceStatus === 'needs-approval' ? t('ops.trade.belowFloor') : l.basis}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <form
                  method="post"
                  action={`/api/v1/ops/trade-orders/${encodeURIComponent(o.number)}/decide`}
                  className="flex flex-col gap-3"
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-ink">{t('ops.trade.reason')}</span>
                    <textarea
                      name="reason"
                      maxLength={500}
                      rows={2}
                      className="w-full rounded-control border border-line-strong bg-transparent px-3 py-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" name="decision" value="approve" icon="check">
                      {t('ops.trade.approve')}
                    </Button>
                    <Button
                      type="submit"
                      name="decision"
                      value="reject"
                      variant="secondary"
                      tone="critical"
                    >
                      {t('ops.trade.reject')}
                    </Button>
                  </div>
                </form>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
