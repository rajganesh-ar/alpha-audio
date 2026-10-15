import type { Metadata } from 'next'
import { EMPTY_LISTING_QUERY } from '@alpha/core'
import { ListingPage } from '@/components/listing/ListingPage'
import { listingMetadata } from '@/components/listing/listingMetadata'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'

type Params = Promise<{ market: string; locale: string; path?: string[] }>

// ISR (ADR 0006). With filter, sort or page parameters the proxy renders the dynamic twin
// in `shop-results` instead, so this page never reads the query and stays cacheable.
export const revalidate = 300
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale, path = [] } = await params
  const route = await getMarketRoute(market, locale)
  return route ? listingMetadata(route, path, EMPTY_LISTING_QUERY) : {}
}

export default async function ShopListing({ params }: { params: Params }) {
  const route = await requireMarketRoute(params)
  const { path = [] } = await params
  return <ListingPage route={route} path={path} query={EMPTY_LISTING_QUERY} />
}
