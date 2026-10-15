import { hasLegacyQuery } from '@alpha/payload/legacy/normalize'
import {
  DEFAULT_LOCALE,
  DEFAULT_MARKET,
  isLocaleCode,
  isMarketCode,
  marketForCountry,
} from '@alpha/payload/markets/codes'

/**
 * What the proxy does with a request, decided from the URL alone (no database):
 *  - `redirect`: canonicalise the URL (root, missing locale, case, trailing slash).
 *  - `market`: a storefront URL; the proxy checks the pair against the Markets record. A shop
 *    listing with filter, sort or page parameters also carries `rewrite`: the internal path of
 *    its dynamic twin (docs/tasks/0007), so the unfiltered page can stay ISR.
 *  - `legacy`: an old-site URL; looked up in LegacyRedirects, then `fallback` on a miss.
 *  - `not-found`: would reach `[market]/[locale]` with a first segment that is no market.
 *  - `next`: anything else (Next routes it, or renders the global 404).
 */
export type RoutingDecision =
  | { kind: 'redirect'; location: string; status: 308 }
  | { kind: 'market'; market: string; locale: string; rewrite?: string }
  | { kind: 'legacy'; fallback: 'next' | 'not-found' }
  | { kind: 'not-found' }
  | { kind: 'next' }

/**
 * Next's reserved 404 route. Rewriting to it renders global-not-found on the server with
 * status 404. A notFound() thrown by a page in the `[market]/[locale]` root layout would also
 * 404, but Next renders that as an empty shell and builds the page in the browser.
 */
export const NOT_FOUND_PATH = '/_not-found'

/**
 * Internal segment of the dynamic listing twin: `/ae/en/shop/amplifiers/?brand=x` renders
 * `/ae/en/shop-results/amplifiers/?brand=x`. Requests for the twin itself 404.
 */
export const LISTING_TWIN = 'shop-results'

const LISTING_PARAMS = new Set(['brand', 'price', 'stock', 'sort', 'page'])

const isListingParam = (key: string) => LISTING_PARAMS.has(key) || key.startsWith('spec.')

/**
 * The listing query without no-op values a GET form submits: empty values (the "any price"
 * radio), `sort=featured` and `page=1`. Null when nothing changes.
 */
export function cleanListingSearch(params: URLSearchParams): string | null {
  const kept = new URLSearchParams()
  let dropped = false
  for (const [key, value] of params) {
    const noop =
      isListingParam(key) &&
      (value === '' ||
        (key === 'sort' && value === 'featured') ||
        (key === 'page' && value === '1'))
    if (noop) dropped = true
    else kept.append(key, value)
  }
  if (!dropped) return null
  const search = kept.toString()
  return search ? `?${search}` : ''
}

/** Whether a query changes what a listing shows (tracking parameters do not). */
export function hasListingParams(params: URLSearchParams): boolean {
  for (const key of params.keys()) if (isListingParam(key)) return true
  return false
}

const redirect = (location: string): RoutingDecision => ({
  kind: 'redirect',
  location,
  status: 308,
})

export function decideRoute(url: URL): RoutingDecision {
  const { pathname, search } = url

  if (pathname === '/') {
    return hasLegacyQuery(url.searchParams)
      ? { kind: 'legacy', fallback: 'next' }
      : redirect(`/${DEFAULT_MARKET}/${DEFAULT_LOCALE}/${search}`)
  }

  const segments = pathname.split('/') // ['', market, locale, ...rest]
  const first = segments[1] ?? ''
  const market = first.toLowerCase()

  if (isMarketCode(market)) {
    const second = segments[2] ?? ''
    if (second === '') return redirect(`/${market}/${DEFAULT_LOCALE}/${search}`)

    const locale = second.toLowerCase()
    const knownLocale = isLocaleCode(locale)
    // One hop to the canonical form: lower-case codes and, under a known locale, a trailing slash.
    let canonical = ['', market, knownLocale ? locale : second, ...segments.slice(3)].join('/')
    if (knownLocale && !canonical.endsWith('/')) canonical += '/'
    if (canonical !== pathname) return redirect(`${canonical}${search}`)
    const section = segments[3] ?? ''
    if (section === LISTING_TWIN) return { kind: 'not-found' }
    if (knownLocale && section === 'shop' && hasListingParams(url.searchParams)) {
      const clean = cleanListingSearch(url.searchParams)
      if (clean !== null) return redirect(`${pathname}${clean}`)
      return {
        kind: 'market',
        market,
        locale,
        rewrite: ['', market, locale, LISTING_TWIN, ...segments.slice(4)].join('/'),
      }
    }
    return { kind: 'market', market, locale: knownLocale ? locale : second }
  }

  // Two or more segments land in `[market]/[locale]`, which this first segment can never satisfy.
  const reachesMarketLayout = segments.filter(Boolean).length >= 2
  if (hasLegacyQuery(url.searchParams)) {
    return { kind: 'legacy', fallback: reachesMarketLayout ? 'not-found' : 'next' }
  }
  return reachesMarketLayout ? { kind: 'not-found' } : { kind: 'next' }
}

/**
 * The market to suggest for a visitor's country, or null when there is nothing to (re)write:
 * outside the GCC, unknown country, or the cookie already says so. Never a redirect.
 */
export function suggestedMarketUpdate(
  country: string | null | undefined,
  current: string | undefined,
): string | null {
  const market = marketForCountry(country)
  return market && market !== current ? market : null
}
