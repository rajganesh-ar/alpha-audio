import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { toShopperOrder } from '@alpha/payload'
import { getDictionary, translator } from '@alpha/ui'
import { AccountHeader } from '@/components/account/AccountHeader'
import { OrderDetail } from '@/components/commerce/OrderDetail'
import { customerSession } from '@/lib/account'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
import { localizedPath } from '@/lib/seo'

export const dynamic = 'force-dynamic'

type Params = Promise<{ market: string; locale: string; number: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale, number } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  return {
    title: translator(getDictionary(route.locale))('orders.title', {
      number: decodeURIComponent(number),
    }),
    robots: { index: false, follow: false },
  }
}

/** One of the customer's orders in My Alpha; another customer's order number is a 404. */
export default async function AccountOrderPage({ params }: { params: Params }) {
  const route = await requireMarketRoute(params)
  const { number } = await params
  const { payload, customer, csrf } = await customerSession()
  if (!customer) redirect(localizedPath(route.market.code, route.locale, '/account'))
  const { docs } = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { number: { equals: decodeURIComponent(number) } },
        { market: { equals: route.market.code } },
        { status: { equals: 'confirmed' } },
      ],
    },
    limit: 1,
    depth: 1,
    user: customer,
    overrideAccess: false,
  })
  const doc = docs[0]
  if (!doc) notFound()
  const t = translator(getDictionary(route.locale))
  return (
    <div className="flex flex-col gap-8">
      <AccountHeader route={route} customer={customer} csrf={csrf} current="orders" />
      <OrderDetail
        order={toShopperOrder(doc as never)}
        route={route}
        headingLevel={2}
        back={{
          href: localizedPath(route.market.code, route.locale, '/account/orders'),
          label: t('account.back'),
        }}
      />
    </div>
  )
}
