import type { Metadata } from 'next'
import { getDictionary, translator } from '@alpha/ui'
import { getMarketRoute, getMarkets, requireMarketRoute } from '@/lib/markets'
import { alternatesFor } from '@/lib/seo'

type Params = Promise<{ market: string; locale: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  const t = translator(getDictionary(route.locale))
  return {
    title: { absolute: t('home.title', { market: route.market.name[route.locale] }) },
    description: t('home.lede'),
    alternates: alternatesFor(await getMarkets(), route, '/'),
  }
}

/** Market home. Placeholder content until the home page task; proves routing and direction. */
export default async function MarketHome({ params }: { params: Params }) {
  const route = await requireMarketRoute(params)
  const t = translator(getDictionary(route.locale))
  return (
    <>
      <h1 className="font-display text-4xl font-bold text-ink font-stretch-expanded">
        {t('home.title', { market: route.market.name[route.locale] })}
      </h1>
      <p className="mt-4 text-lg text-ink-muted">{t('home.lede')}</p>
    </>
  )
}
