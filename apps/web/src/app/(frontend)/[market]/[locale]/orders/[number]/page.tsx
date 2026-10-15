import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { loadShopperOrder } from '@alpha/payload'
import { Button, EmptyState, getDictionary, translator } from '@alpha/ui'
import { OrderDetail } from '@/components/commerce/OrderDetail'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
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
  return <OrderDetail order={order} route={route} />
}
