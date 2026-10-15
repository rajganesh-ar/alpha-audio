import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { formatMoney } from '@alpha/core'
import { loadShopperOrder, type ShopperOrder } from '@alpha/payload'
import {
  Button,
  EmptyState,
  ErrorState,
  OrderSummary,
  getDictionary,
  translator,
  type MessageKey,
} from '@alpha/ui'
import { summaryRows } from '@/components/commerce/summaryRows'
import { checkoutPaths } from '@/lib/api/checkout'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
import { numberLocale } from '@/lib/productView'
import { localizedPath } from '@/lib/seo'

// Per-shopper and never cached: it reads the bag cookie or an order's access token, so the
// response is `private, no-store` (CLAUDE.md rule 4).
export const dynamic = 'force-dynamic'

type Params = Promise<{ market: string; locale: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  return {
    title: translator(getDictionary(route.locale))('checkout.return.metaTitle'),
    robots: { index: false, follow: false },
  }
}

type Outcome = 'confirmed' | 'pending' | 'failed' | 'expired' | 'stockLost'

function outcomeOf(order: ShopperOrder): Outcome {
  switch (order.status) {
    case 'confirmed':
      return 'confirmed'
    case 'expired':
      return 'expired'
    case 'failed':
    case 'unavailable':
      return order.failureReason === 'stock-lost' ? 'stockLost' : 'failed'
    default:
      return 'pending'
  }
}

/**
 * Where the payment provider sends the shopper back (docs/tasks/0009). The order is shown only
 * with the access token from its link. While the payment is still being confirmed the page
 * refreshes itself (meta refresh), so it works without JavaScript.
 */
export default async function CheckoutReturnPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const route = await requireMarketRoute(params)
  const search = await searchParams
  const t = translator(getDictionary(route.locale))
  const paths = checkoutPaths(route)
  const one = (key: string) => (typeof search[key] === 'string' ? (search[key] as string) : '')
  const order = await loadShopperOrder(await getPayload({ config }), one('order'), one('token'))
  const shop = `${localizedPath(route.market.code, route.locale)}shop/`

  if (!order || order.market !== route.market.code) {
    return (
      <EmptyState
        title={t('checkout.return.notFoundTitle')}
        body={t('checkout.return.notFoundBody')}
        action={<Button href={shop}>{t('checkout.return.toShop')}</Button>}
      />
    )
  }

  const outcome = outcomeOf(order)
  const locale = numberLocale(route)
  const key = (suffix: 'Title' | 'Body') => `checkout.return.${outcome}${suffix}` as MessageKey
  const reference = { label: t('checkout.return.orderNumber'), code: order.number }

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {outcome === 'pending' ? <meta httpEquiv="refresh" content="3" /> : null}
      <div className="flex flex-col gap-6 lg:col-span-7">
        {outcome === 'confirmed' || outcome === 'pending' ? (
          <section aria-live="polite" className="flex flex-col gap-3">
            <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
              {t(key('Title'))}
            </h1>
            <p className="text-lg text-ink-muted">{t(key('Body'))}</p>
            <p className="text-base text-ink">
              {reference.label}: <span className="font-mono">{order.number}</span>
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {outcome === 'pending' ? (
                <Button
                  variant="secondary"
                  href={`${paths.result}?order=${encodeURIComponent(order.number)}&token=${encodeURIComponent(one('token'))}`}
                >
                  {t('checkout.return.refresh')}
                </Button>
              ) : (
                <>
                  <Button
                    href={`${localizedPath(route.market.code, route.locale, `/orders/${encodeURIComponent(order.number)}`)}?token=${encodeURIComponent(one('token'))}`}
                  >
                    {t('orders.view')}
                  </Button>
                  <Button variant="secondary" href={shop}>
                    {t('checkout.return.toShop')}
                  </Button>
                </>
              )}
            </div>
          </section>
        ) : (
          <>
            <h1 className="sr-only">{t(key('Title'))}</h1>
            <ErrorState
              title={t(key('Title'))}
              body={t(key('Body'))}
              reference={reference}
              action={
                <Button variant="secondary" href={paths.bag}>
                  {t('checkout.return.toBag')}
                </Button>
              }
            />
          </>
        )}
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
