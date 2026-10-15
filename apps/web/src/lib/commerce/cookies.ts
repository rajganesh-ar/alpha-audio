import { CART_TTL_DAYS, CUSTOMER_SESSION_COOKIE } from '@alpha/payload'

/** One bag per market: prices, VAT and rights differ, so a bag never crosses markets. */
export const bagCookie = (market: string): string => `alpha_bag_${market}`

/** Reads one cookie from a request's Cookie header. */
export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

/** `Set-Cookie` for the bag token: httpOnly, SameSite=Lax, Secure on https, seven days. */
export function bagCookieHeader(market: string, token: string, secure: boolean): string {
  return [
    `${bagCookie(market)}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${CART_TTL_DAYS * 86_400}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

/** `Set-Cookie` for the customer session (docs/tasks/0012): httpOnly, SameSite=Lax, until it expires. */
export function sessionCookieHeader(token: string, expiresAt: Date, secure: boolean): string {
  return [
    `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Expires=${expiresAt.toUTCString()}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

/** Clears the session cookie (sign out). */
export function clearSessionCookieHeader(secure: boolean): string {
  return [
    `${CUSTOMER_SESSION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}
