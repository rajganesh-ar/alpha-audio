import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { formatMoney, money, type CurrencyCode, type CurrencyDecimals } from '@alpha/core'
import { EmptyState, Button, getDictionary, translator, type MessageKey } from '@alpha/ui'
import { AccountHeader } from '@/components/account/AccountHeader'
import { customerSession } from '@/lib/account'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
import { numberLocale } from '@/lib/productView'
import { localizedPath } from '@/lib/seo'

export const dynamic = 'force-dynamic'

type Params = Promise<{ market: string; locale: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  const t = translator(getDictionary(route.locale))
  return {
    title: `${t('account.orders')} · ${t('account.metaTitle')}`,
    robots: { index: false, follow: false },
  }
}

/** The customer's step for each fulfilment status (warehouse detail folded). */
const STEP: Record<string, MessageKey> = {
  awaiting: 'orders.steps.picked',
  picking: 'orders.steps.picked',
  picked: 'orders.steps.picked',
  shipping: 'orders.steps.picked',
  shipped: 'orders.steps.shipped',
  delivering: 'orders.steps.shipped',
  delivered: 'orders.steps.delivered',
  cancelling: 'orders.steps.cancelled',
  cancelled: 'orders.steps.cancelled',
}

/**
 * My Alpha → Orders (docs/tasks/0012): orders placed in this market with the signed-in email.
 * Read as the customer (`overrideAccess: false`): the Orders access function limits it to theirs.
 */
export default async function AccountOrdersPage({ params }: { params: Params }) {
  const route = await requireMarketRoute(params)
  const { payload, customer, csrf } = await customerSession()
  if (!customer) redirect(localizedPath(route.market.code, route.locale, '/account'))
  const t = translator(getDictionary(route.locale))
  const { docs } = await payload.find({
    collection: 'orders',
    where: {
      and: [{ market: { equals: route.market.code } }, { status: { equals: 'confirmed' } }],
    },
    sort: '-createdAt',
    limit: 50,
    depth: 0,
    user: customer,
    overrideAccess: false,
  })
  const locale = numberLocale(route)
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeZone: route.market.timezone,
    }).format(new Date(iso))

  return (
    <div className="flex flex-col gap-8">
      <AccountHeader route={route} customer={customer} csrf={csrf} current="orders" />
      {docs.length === 0 ? (
        <EmptyState
          title={t('account.ordersEmpty')}
          body={t('account.ordersEmptyBody')}
          icon="bag"
          action={
            <Button href={localizedPath(route.market.code, route.locale, '/shop')}>
              {t('ui.browseAll')}
            </Button>
          }
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {docs.map((order) => (
            <li key={order.id}>
              <a
                href={localizedPath(
                  route.market.code,
                  route.locale,
                  `/account/orders/${order.number}`,
                )}
                aria-label={t('account.viewOrder', { number: order.number })}
                className="flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-card border border-line p-4 hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="flex flex-col">
                  <span className="font-mono text-base font-semibold text-ink">{order.number}</span>
                  <span className="text-sm text-ink-muted">
                    {t('account.orderPlaced', { date: date(order.createdAt) })}
                  </span>
                </span>
                <span className="text-base text-ink">
                  {t(STEP[order.fulfilment] ?? 'orders.steps.confirmed')}
                </span>
                <bdi className="text-base font-semibold text-ink tabular-nums">
                  {formatMoney(
                    money(
                      order.totals.total,
                      order.currency as CurrencyCode,
                      order.decimals as CurrencyDecimals,
                    ),
                    locale,
                  )}
                </bdi>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
