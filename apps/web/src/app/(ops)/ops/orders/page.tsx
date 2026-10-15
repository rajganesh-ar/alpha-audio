import type { Metadata } from 'next'
import type { Where } from 'payload'
import {
  formatMoney,
  money,
  type CurrencyCode,
  type CurrencyDecimals,
  type FulfilmentStatus,
} from '@alpha/core'
import { Button, EmptyState, type MessageKey } from '@alpha/ui'
import { getMarketsCached } from '@alpha/payload'
import type { Order } from '@/payload-types'
import { loginPath, opsCopy, opsDate, staffSession } from '@/lib/ops'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Orders' }

const QUEUES = {
  awaiting: ['awaiting', 'picking'],
  picked: ['picked', 'shipping'],
  shipped: ['shipped', 'delivering'],
  delivered: ['delivered'],
  cancelled: ['cancelled', 'cancelling'],
  all: null,
} as const satisfies Record<string, readonly FulfilmentStatus[] | null>
type Queue = keyof typeof QUEUES

const isQueue = (value: unknown): value is Queue =>
  typeof value === 'string' && Object.hasOwn(QUEUES, value)

/**
 * The order queue (docs/tasks/0010): confirmed web orders by fulfilment status, oldest first,
 * so the next order to pick is at the top. Staff only; read as the staff user (access applies).
 */
export default async function OpsOrdersPage({
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
        action={<Button href={loginPath('/ops/orders/')}>{t('ops.signInAction')}</Button>}
      />
    )
  }
  const requested = (await searchParams)['queue']
  const queue: Queue = isQueue(requested) ? requested : 'awaiting'
  const statuses = QUEUES[queue]
  const where: Where = {
    and: [
      { status: { equals: 'confirmed' } },
      ...(statuses ? [{ fulfilment: { in: [...statuses] } }] : []),
    ],
  }
  const { docs } = await payload.find({
    collection: 'orders',
    where,
    sort:
      queue === 'all' || queue === 'delivered' || queue === 'cancelled'
        ? '-createdAt'
        : 'createdAt',
    limit: 100,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const zones = new Map((await getMarketsCached(payload)).map((m) => [m.code, m.timezone]))
  const total = (o: Order) =>
    formatMoney(
      money(o.totals.total, o.currency as CurrencyCode, o.decimals as CurrencyDecimals),
      `en-${o.market.toUpperCase()}`,
    )

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold text-ink">{t('ops.title')}</h1>
      <nav aria-label={t('ops.title')}>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {(Object.keys(QUEUES) as Queue[]).map((q) => (
            <li key={q}>
              <a
                href={`/ops/orders/?queue=${q}`}
                aria-current={q === queue ? 'page' : undefined}
                className="inline-flex min-h-11 items-center rounded-control border border-line-strong px-4 text-base text-ink aria-[current=page]:border-lacquer aria-[current=page]:bg-lacquer aria-[current=page]:text-aluminium"
              >
                {t(`ops.queues.${q}` as MessageKey)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {docs.length === 0 ? (
        <EmptyState title={t('ops.empty')} icon="bag" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-start text-base">
            <thead>
              <tr className="border-b border-line-strong text-sm text-ink-muted">
                {(['number', 'placed', 'customer', 'items', 'total', 'status'] as const).map(
                  (c) => (
                    <th key={c} scope="col" className="py-2 pe-4 text-start font-semibold">
                      {t(`ops.columns.${c}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {docs.map((o) => (
                <tr key={o.id} className="border-b border-line">
                  <td className="py-3 pe-4">
                    <a
                      href={`/ops/orders/${o.number}/`}
                      className="font-mono text-ink underline underline-offset-4"
                    >
                      {o.number}
                    </a>
                  </td>
                  <td className="py-3 pe-4 text-ink">
                    {opsDate(o.createdAt, zones.get(o.market) ?? 'UTC')}
                  </td>
                  <td className="py-3 pe-4 text-ink">{o.contact?.name ?? ''}</td>
                  <td className="py-3 pe-4 text-ink tabular-nums">
                    {(o.lines ?? []).reduce((n, l) => n + l.qty, 0)}
                  </td>
                  <td className="py-3 pe-4 text-ink tabular-nums">{total(o)}</td>
                  <td className="py-3 pe-4 text-ink">
                    {t(`ops.fulfilment.${o.fulfilment}` as MessageKey)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
