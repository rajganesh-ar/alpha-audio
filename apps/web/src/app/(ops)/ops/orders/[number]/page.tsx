import type { Metadata } from 'next'
import { formatMoney, money, type CurrencyCode, type CurrencyDecimals } from '@alpha/core'
import { getMarketsCached } from '@alpha/payload'
import {
  Button,
  CheckoutSection,
  EmptyState,
  Input,
  type MessageKey,
  type Translate,
} from '@alpha/ui'
import type { Location, Reservation, Shipment } from '@/payload-types'
import { Notice } from '@/components/commerce/Notice'
import { loginPath, opsCopy, opsDate, staffSession } from '@/lib/ops'

export const dynamic = 'force-dynamic'

type Params = Promise<{ number: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: decodeURIComponent((await params).number) }
}

const RESULTS = ['picked', 'shipped', 'delivered', 'cancelled', 'refunded'] as const

/**
 * One order for the warehouse (docs/tasks/0010): what to pick and where, who it goes to, and
 * the next step as a plain form. Each form posts to `/api/v1/ops/orders/{number}/{action}`.
 */
export default async function OpsOrderPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const t = opsCopy()
  const number = decodeURIComponent((await params).number)
  const search = await searchParams
  const { payload, user } = await staffSession()
  const back = `/ops/orders/${encodeURIComponent(number)}/`
  if (!user) {
    return (
      <EmptyState
        title={t('ops.signIn')}
        icon="user"
        action={<Button href={loginPath(back)}>{t('ops.signInAction')}</Button>}
      />
    )
  }
  const { docs } = await payload.find({
    collection: 'orders',
    where: { number: { equals: number } },
    limit: 1,
    depth: 1,
    user,
    overrideAccess: false,
  })
  const order = docs[0]
  if (!order)
    return (
      <EmptyState
        title={t('ops.results.not-found')}
        action={<Button href="/ops/orders/">{t('ops.back')}</Button>}
      />
    )

  const ids = Array.isArray(order.reservations) ? (order.reservations as number[]) : []
  const holds = ids.length
    ? (
        await payload.find({
          collection: 'reservations',
          where: { id: { in: ids } },
          limit: ids.length,
          depth: 1,
          user,
          overrideAccess: false,
        })
      ).docs
    : []
  const market = (await getMarketsCached(payload)).find((m) => m.code === order.market)
  const zone = market?.timezone ?? 'UTC'
  const tag = `en-${order.market.toUpperCase()}`
  const m = (amount: number) =>
    formatMoney(
      money(amount, order.currency as CurrencyCode, order.decimals as CurrencyDecimals),
      tag,
    )
  const shipment = typeof order.shipment === 'object' ? (order.shipment as Shipment | null) : null
  const result =
    typeof search['result'] === 'string' &&
    (RESULTS as readonly string[]).includes(search['result'])
      ? search['result']
      : null
  const error = typeof search['error'] === 'string' ? search['error'] : null
  const action = (step: string) => `/api/v1/ops/orders/${encodeURIComponent(order.number)}/${step}`
  const confirmed = order.status === 'confirmed'
  const f = order.fulfilment
  const canRefund =
    (order.payment?.status === 'captured' || order.payment?.status === 'authorised') &&
    (order.refund.status === 'none' || order.refund.status === 'failed') &&
    (f === 'cancelled' || (order.status === 'failed' && order.failureReason === 'stock-lost'))

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p>
          <a href="/ops/orders/" className="text-base text-ink underline underline-offset-4">
            {t('ops.back')}
          </a>
        </p>
        <h1 className="font-display text-3xl font-bold text-ink">
          <span className="font-mono">{order.number}</span>
        </h1>
        <p className="text-base text-ink-muted">
          {opsDate(order.createdAt, zone)} · {order.status} ·{' '}
          {t(`ops.fulfilment.${f}` as MessageKey)}
        </p>
      </div>
      {result ? <Notice tone="info">{t(`ops.results.${result}` as MessageKey)}</Notice> : null}
      {error ? <Notice tone="critical">{resultText(t, error)}</Notice> : null}

      <div className="grid gap-8 lg:grid-cols-12">
        <section className="flex flex-col gap-4 lg:col-span-7">
          <h2 className="font-display text-xl font-bold text-ink">{t('ops.lines')}</h2>
          <table className="w-full border-collapse text-base">
            <thead>
              <tr className="border-b border-line-strong text-sm text-ink-muted">
                {(['sku', 'qty', 'location', 'serials'] as const).map((c) => (
                  <th key={c} scope="col" className="py-2 pe-4 text-start font-semibold">
                    {t(`ops.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(order.lines ?? []).map((line) => {
                const hold = holds.find((h) => h.sku === line.sku) as Reservation | undefined
                const location =
                  hold && typeof hold.location === 'object' ? (hold.location as Location) : null
                const serials = Array.isArray(hold?.serials) ? (hold.serials as string[]) : []
                return (
                  <tr key={line.id ?? line.sku} className="border-b border-line align-top">
                    <td className="py-3 pe-4 text-ink">
                      <span className="block">{line.title}</span>
                      <span className="block font-mono text-sm text-ink-muted">{line.sku}</span>
                    </td>
                    <td className="py-3 pe-4 text-ink tabular-nums">{line.qty}</td>
                    <td className="py-3 pe-4 font-mono text-ink">{location?.code ?? '—'}</td>
                    <td className="py-3 pe-4 font-mono text-sm text-ink">
                      {serials.join(', ') || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-base text-ink">
            {t('ops.columns.total')}:{' '}
            <span className="font-semibold tabular-nums">{m(order.totals.total)}</span>
          </p>

          {confirmed && (f === 'awaiting' || f === 'picking') ? (
            <form method="post" action={action('pick')}>
              <Button type="submit" icon="check">
                {t('ops.pick')}
              </Button>
            </form>
          ) : null}
          {confirmed && (f === 'picked' || f === 'shipping') ? (
            <CheckoutSection step={1} title={t('ops.ship')}>
              <form method="post" action={action('ship')} className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label={t('ops.courier')} name="courier" required maxLength={60} />
                  <Input
                    label={t('ops.tracking')}
                    name="trackingNumber"
                    required
                    maxLength={64}
                    dir="ltr"
                  />
                </div>
                <Input
                  label={t('ops.trackingUrl')}
                  name="trackingUrl"
                  type="url"
                  maxLength={500}
                  dir="ltr"
                />
                <div>
                  <Button type="submit" icon="truck">
                    {t('ops.ship')}
                  </Button>
                </div>
              </form>
            </CheckoutSection>
          ) : null}
          {confirmed && (f === 'shipped' || f === 'delivering') ? (
            <form method="post" action={action('deliver')}>
              <Button type="submit" icon="check">
                {t('ops.deliver')}
              </Button>
            </form>
          ) : null}
          {canRefund ? (
            <form method="post" action={action('refund')}>
              <Button type="submit" variant="secondary">
                {t('ops.refund')}
              </Button>
            </form>
          ) : null}
          {confirmed && (f === 'awaiting' || f === 'picked' || f === 'cancelling') ? (
            <details className="rounded-card border border-line p-4">
              <summary className="min-h-11 cursor-pointer content-center text-base font-semibold text-critical">
                {t('ops.cancel')}
              </summary>
              <form method="post" action={action('cancel')} className="mt-4 flex flex-col gap-4">
                <Input label={t('ops.cancelReason')} name="reason" required maxLength={300} />
                <div>
                  <Button type="submit" variant="secondary" tone="critical">
                    {t('ops.cancel')}
                  </Button>
                </div>
              </form>
            </details>
          ) : null}
        </section>

        <aside className="flex flex-col gap-6 lg:col-span-5">
          <Facts
            title={t('ops.contact')}
            rows={[
              [t('checkout.name'), order.contact?.name ?? ''],
              [t('checkout.email'), order.contact?.email ?? ''],
              [t('checkout.phone'), order.contact?.phone ?? ''],
            ]}
          />
          <Facts
            title={t('ops.address')}
            rows={Object.entries((order.address ?? {}) as Record<string, string>).map(([k, v]) => [
              t(`checkout.address.${k}` as MessageKey),
              v,
            ])}
          />
          <Facts
            title={t('ops.payment')}
            rows={[
              [t('checkout.methods.label'), order.paymentMethod ?? ''],
              [order.payment?.provider ?? '', order.payment?.status ?? ''],
              [t('ops.refundLabel'), t(`ops.refundStatus.${order.refund.status}` as MessageKey)],
              ...(order.refund.reference
                ? ([['', order.refund.reference]] as Array<[string, string]>)
                : []),
              ...(order.cancelReason
                ? ([[t('ops.cancelReason'), order.cancelReason]] as Array<[string, string]>)
                : []),
            ]}
          />
          {shipment ? (
            <Facts
              title={`${t('ops.shipment')} ${shipment.number}`}
              rows={[
                [t('ops.courier'), shipment.courier],
                [t('ops.tracking'), shipment.trackingNumber],
                [t('ops.fulfilment.shipped'), opsDate(shipment.shippedAt, zone)],
                ...(shipment.deliveredAt
                  ? ([
                      [t('ops.fulfilment.delivered'), opsDate(shipment.deliveredAt, zone)],
                    ] as Array<[string, string]>)
                  : []),
              ]}
            />
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function resultText(t: Translate, code: string): string {
  const known = [
    'not-found',
    'not-confirmed',
    'wrong-status',
    'hold-missing',
    'invalid-shipment',
    'not-refundable',
    'invalid',
  ]
  return t(`ops.results.${known.includes(code) ? code : 'invalid'}` as MessageKey)
}

function Facts({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-line p-4">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <dl className="flex flex-col gap-1 text-base">
        {rows.map(([label, value], i) => (
          <div key={`${label}-${i}`} className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
