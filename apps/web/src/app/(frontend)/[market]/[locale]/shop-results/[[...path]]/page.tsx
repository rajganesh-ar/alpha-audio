import type { Metadata } from 'next'
import { ListingPage } from '@/components/listing/ListingPage'
import { listingMetadata } from '@/components/listing/listingMetadata'
import { parseListingQuery } from '@/lib/listing'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'

type Params = Promise<{ market: string; locale: string; path?: string[] }>
type Search = Promise<Record<string, string | string[] | undefined>>

/**
 * Dynamic twin of `/shop/…` for filtered, sorted or paged listings (docs/tasks/0007). Reached
 * only through the proxy's rewrite; a direct request for `/shop-results/…` is a 404.
 */
const toParams = (search: Awaited<Search>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search))
    for (const v of [value ?? []].flat()) params.append(key, v)
  return params
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}): Promise<Metadata> {
  const { market, locale, path = [] } = await params
  const route = await getMarketRoute(market, locale)
  return route
    ? listingMetadata(route, path, parseListingQuery(toParams(await searchParams), route.market))
    : {}
}

export default async function ShopListingResults({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const route = await requireMarketRoute(params)
  const { path = [] } = await params
  return (
    <ListingPage
      route={route}
      path={path}
      query={parseListingQuery(toParams(await searchParams), route.market)}
    />
  )
}
