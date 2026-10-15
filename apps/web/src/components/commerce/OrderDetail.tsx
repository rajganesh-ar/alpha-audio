import { formatMoney } from '@alpha/core'
import type { MarketRoute, ShopperOrder } from '@alpha/payload'
import {
  Button,
  OrderSummary,
  OrderTimeline,
  getDictionary,
  translator,
  type MessageKey,
} from '@alpha/ui'
import { orderSteps } from '@/lib/commerce/orderSteps'
import { numberLocale } from '@/lib/productView'
import { Notice } from './Notice'
import { summaryRows } from './summaryRows'

/**
 * An order as its customer sees it (docs/tasks/0010, 0012): progress, tracking, refund, lines
 * and totals. Shared by the token link page and My Alpha.
 */
export function OrderDetail({
  order,
  route,
  back,
  headingLevel = 1,
}: {
  order: ShopperOrder
  route: MarketRoute
  /** A link above the title, e.g. back to My Alpha's orders. */
  back?: { href: string; label: string } | undefined
  /** 2 when the page already has its own h1 (My Alpha). */
  headingLevel?: 1 | 2 | undefined
}) {
  const Title = headingLevel === 2 ? 'h2' : 'h1'
  const t = translator(getDictionary(route.locale))
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
          {back ? (
            <p>
              <a href={back.href} className="text-base text-ink underline underline-offset-4">
                {back.label}
              </a>
            </p>
          ) : null}
          <Title className="font-display text-3xl font-bold text-ink font-stretch-expanded">
            {t('orders.title', { number: order.number })}
          </Title>
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
