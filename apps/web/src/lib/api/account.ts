import type { Payload } from 'payload'
import {
  CUSTOMER_SESSION_COOKIE,
  LOCALE_CODES,
  checkSessionCsrf,
  completeSignIn,
  endSession,
  getMarketsCached,
  requestSignIn,
  resolveMarketRoute,
  type MarketRoute,
} from '@alpha/payload'
import { clearSessionCookieHeader, readCookie, sessionCookieHeader } from '@/lib/commerce/cookies'
import { localizedPath, siteUrl } from '@/lib/seo'
import { readFields, seeOther, withQuery } from './forms'
import { crossSite, problem } from './respond'

/**
 * My Alpha sign-in (docs/tasks/0012, ADR 0012): request a one-time link by email, exchange it for
 * a session, sign out. Plain forms with `303` answers; same-origin checked; the session cookie
 * is httpOnly and SameSite=Lax, and sign-out also needs the session's CSRF token.
 */

export interface AccountDeps {
  payload: Payload
  now?: () => Date
  /** Runs work after the response is sent (`after` in Next.js); inline elsewhere. */
  defer?: (work: () => Promise<unknown>) => void
}

const secure = () => siteUrl().protocol === 'https:'

async function routeFor(
  payload: Payload,
  market: string,
  fields: Record<string, unknown>,
): Promise<MarketRoute | null> {
  const locale =
    typeof fields['locale'] === 'string' &&
    (LOCALE_CODES as readonly string[]).includes(fields['locale'])
      ? fields['locale']
      : ''
  return resolveMarketRoute(await getMarketsCached(payload), market, locale)
}

const accountPath = (route: MarketRoute, path = '/account') =>
  localizedPath(route.market.code, route.locale, path)

/** The visitor's network address as the edge reports it (Cloudflare first). */
export function clientIp(request: Request): string | null {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  )
}

/** `POST /api/v1/markets/{market}/account/sign-in`: emails a sign-in link. */
export async function postSignIn(
  deps: AccountDeps,
  request: Request,
  market: string,
): Promise<Response> {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const fields = (await readFields(request)) ?? {}
  const route = await routeFor(deps.payload, market, fields)
  if (!route) return problem(404, 'unknown-market', 'No such market.')
  const result = await requestSignIn(
    deps.payload,
    {
      email: fields['email'],
      market: route.market.code,
      locale: route.locale,
      ip: clientIp(request),
      origin: siteUrl().origin,
    },
    deps.now?.(),
  )
  if (!result.ok) return seeOther(withQuery(accountPath(route), { status: result.reason }))
  // Send now rather than on the next cron tick; the queue still retries if this fails.
  const job = result.job
  if (job !== null) {
    const send = () => deps.payload.jobs.runByID({ id: job }).catch(() => undefined)
    if (deps.defer) deps.defer(send)
    else await send()
  }
  return seeOther(withQuery(accountPath(route), { status: 'sent' }))
}

/** `POST /api/v1/markets/{market}/account/verify`: uses the link and starts a session. */
export async function postVerify(
  deps: AccountDeps,
  request: Request,
  market: string,
): Promise<Response> {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const fields = (await readFields(request)) ?? {}
  const route = await routeFor(deps.payload, market, fields)
  if (!route) return problem(404, 'unknown-market', 'No such market.')
  const token = typeof fields['token'] === 'string' ? fields['token'].slice(0, 100) : ''
  const result = await completeSignIn(deps.payload, token, deps.now?.())
  if (!result.ok) return seeOther(withQuery(accountPath(route), { status: result.reason }))
  return seeOther(accountPath(route, '/account/orders'), [
    sessionCookieHeader(result.session, result.expiresAt, secure()),
  ])
}

/** `POST /api/v1/markets/{market}/account/sign-out`: ends the session (CSRF token required). */
export async function postSignOut(
  deps: AccountDeps,
  request: Request,
  market: string,
): Promise<Response> {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const fields = (await readFields(request)) ?? {}
  const route = await routeFor(deps.payload, market, fields)
  if (!route) return problem(404, 'unknown-market', 'No such market.')
  const session = readCookie(request, CUSTOMER_SESSION_COOKIE)
  if (session) {
    if (!checkSessionCsrf(deps.payload, session, fields['csrf']))
      return problem(403, 'csrf', 'The form has expired. Reload the page and try again.')
    await endSession(deps.payload, session, deps.now?.())
  }
  return seeOther(withQuery(accountPath(route), { status: 'signed-out' }), [
    clearSessionCookieHeader(secure()),
  ])
}
