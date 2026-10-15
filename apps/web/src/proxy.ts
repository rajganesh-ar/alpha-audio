import { NextResponse, type NextRequest } from 'next/server'
import { SUGGESTED_MARKET_COOKIE, SUGGESTED_MARKET_MAX_AGE } from '@alpha/ui/cookies'
import {
  NOT_FOUND_PATH,
  decideRoute,
  suggestedMarketUpdate,
  type RoutingDecision,
} from './lib/routing'

/**
 * Storefront proxy (Next 16's name for middleware).
 *  - `/` → `/ae/en/`; `/ae` → `/ae/en/`; `/AE/EN` → `/ae/en/`; storefront paths gain a trailing slash.
 *  - `/{market}/{locale}/…` must be a live market offering that locale (Markets record), else 404.
 *  - Old-site URLs carrying `?bid=` or `?catid=` are looked up in LegacyRedirects (301).
 *  - Filtered, sorted or paged shop listings render their dynamic twin (`shop-results`).
 *  - `cf-ipcountry` sets the `suggestedMarket` cookie for the banner. It never redirects.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const decision = decideRoute(request.nextUrl)
  const response = await respond(request, decision)

  const suggestion = suggestedMarketUpdate(
    request.headers.get('cf-ipcountry'),
    request.cookies.get(SUGGESTED_MARKET_COOKIE)?.value,
  )
  if (suggestion) {
    response.cookies.set(SUGGESTED_MARKET_COOKIE, suggestion, {
      path: '/',
      maxAge: SUGGESTED_MARKET_MAX_AGE,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      httpOnly: false, // read by the banner in the browser so pages stay cacheable
    })
  }
  return response
}

const notFound = (request: NextRequest) =>
  NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url))

async function respond(request: NextRequest, decision: RoutingDecision): Promise<NextResponse> {
  switch (decision.kind) {
    case 'redirect':
      return NextResponse.redirect(new URL(decision.location, request.url), decision.status)

    case 'market': {
      try {
        const { isRoutableMarket } = await import('./lib/marketCheck')
        if (!(await isRoutableMarket(decision.market, decision.locale))) return notFound(request)
      } catch (error) {
        // Unreadable record: let the layout decide (it renders no shell for an invalid pair).
        console.error('market_check_failed', error)
      }
      if (decision.rewrite) {
        const target = new URL(decision.rewrite, request.url)
        target.search = request.nextUrl.search
        return NextResponse.rewrite(target)
      }
      return NextResponse.next()
    }

    case 'legacy': {
      try {
        const { lookupLegacy } = await import('./lib/legacy')
        const hit = await lookupLegacy(request.nextUrl)
        if (hit) return NextResponse.redirect(new URL(hit.location, request.url), hit.status)
      } catch (error) {
        // A failed lookup must not take the page down; the request falls through to a 404.
        console.error('legacy_redirect_lookup_failed', error)
      }
      return decision.fallback === 'not-found' ? notFound(request) : NextResponse.next()
    }

    case 'not-found':
      return notFound(request)

    case 'next':
      return NextResponse.next()
  }
}

export const config = {
  // Everything except Payload (admin, api), Next internals and static files. `.php` and
  // `.html` are not excluded: old-site links may use them.
  matcher: [
    '/((?!api(?:/|$)|admin(?:/|$)|_next/|.*\\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|map|txt|xml|woff2?|ttf|otf|json|webmanifest)$).*)',
  ],
}
