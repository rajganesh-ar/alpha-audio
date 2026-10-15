import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { formatMoney } from '@alpha/core'
import { loadShopperOrder } from '@alpha/payload'
import {
  Button,
  EmptyState,
  OrderSummary,
  OrderTimeline,
  getDictionary,
  translator,
  type MessageKey,
} from '@alpha/ui'
import { Notice } from '@/components/commerce/Notice'
import { summaryRows } from '@/components/commerce/summaryRows'
import { orderSteps } from '@/lib/commerce/orderSteps'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
import { numberLocale } from '@/lib/productView'
import { localizedPath } from '@/lib/seo'

// Per-shopper and never cached: the order is shown only with the token from its link.
export const dynamic = 'force-dynamic'

type Params = Promise<{ market: string; locale: string; number: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  return {
    title: translator(getDictionary(route.locale))('orders.metaTitle'),
    robots: { index: false, follow: false },
  }
}

/**
 * The customer's order page (docs/tasks/0010), linked from every order email: progress,
 * shipment and tracking, refund, lines and totals. Shown only with the order's access token.
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const route = await requireMarketRoute(params)
  const { number } = await params
  const search = await searchParams
  const t = translator(getDictionary(route.locale))
  const token = typeof search['token'] === 'string' ? search['token'] : ''
  const order = await loadShopperOrder(
    await getPayload({ config }),
    decodeURIComponent(number),
    token,
  )
  const shop = `${localizedPath(route.market.code, route.locale)}shop/`

  if (!order || order.market !== route.market.code) {
    return (
      <EmptyState
        title={t('orders.notFoundTitle')}
        body={t('orders.notFoundBody')}
        action={<Button href={shop}>{t('checkout.return.toShop')}</Button>}
      />
    )
  }
  const locale = numberLocale(route)
  const date = (d: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: route.market.timezone,
    }).format(d)
  const refund = order.refund.status !== 'none' && order.refund.amount ? order.refund : null

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="flex flex-col gap-6 lg:col-span-7">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
            {t('orders.title', { number: order.number })}
          </h1>
          <p className="text-base text-ink-muted">
            {t('orders.placed', { date: date(order.placedAt) })}
          </p>
        </div>
        {refund ? (
          <Notice tone="info">
            {t(`orders.refund.${refund.status}` as MessageKey, {
              amount: formatMoney(refund.amount ?? order.totals.total, locale),
            })}
          </Notice>
        ) : null}
        <OrderTimeline label={t('orders.progress')} steps={orderSteps(order, t, date)} />
        {order.shipment?.trackingUrl ? (
          <div>
            <Button variant="secondary" href={order.shipment.trackingUrl} icon="truck">
              {t('orders.track')}
            </Button>
          </div>
        ) : null}
        <p className="text-base text-ink-muted">{t('orders.help')}</p>
      </div>
      <aside className="lg:col-span-5">
        <OrderSummary title={t('bag.summary')} rows={summaryRows(t, order.totals, locale)} />
        <ul className="mt-4 flex flex-col gap-1 text-sm text-ink-muted">
          {order.lines.map((line) => (
            <li key={line.sku} className="flex justify-between gap-4">
              <span>
                {line.qty} × {line.title}
              </span>
              <bdi className="tabular-nums">{formatMoney(line.lineTotal, locale)}</bdi>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
