import { createLocalReq, logoutOperation, type Payload } from 'payload'
import { normaliseEmail } from '@alpha/core'
import { isCompanyUser } from '../access'

/**
 * Dealer board sessions (docs/tasks/0014, ADR 0014): company users sign in with email and
 * password through Payload's own auth (hashed passwords, lockout after 5 failures for 15 minutes,
 * a server-side session id inside the JWT). Only the `company-users` collection can sign in
 * here; staff and customers cannot. Signing out removes the session, so an old cookie stops
 * working, not only the browser's copy.
 */

export const PARTNER_COLLECTION = 'company-users'
const MAX_PASSWORD_LENGTH = 256
const UNAUTHORIZED = 401

export type PartnerSignInResult =
  | { ok: true; token: string; expiresAt: Date; locale: 'en' | 'ar' }
  | { ok: false; reason: 'missing' | 'invalid' | 'locked' }

/** Signs a company user in; `invalid` never says whether the address exists. */
export async function signInPartner(
  payload: Payload,
  input: { email: unknown; password: unknown },
): Promise<PartnerSignInResult> {
  const email = normaliseEmail(input.email)
  const password = typeof input.password === 'string' ? input.password : ''
  if (!email || !password || password.length > MAX_PASSWORD_LENGTH)
    return { ok: false, reason: 'missing' }
  try {
    // Payload's login checks the password and lockout itself; it reads only this collection.
    const result = await payload.login({
      collection: PARTNER_COLLECTION,
      data: { email, password },
      depth: 0,
    })
    const user = result.user as { locale?: string | null } | undefined
    if (!result.token || !result.exp) return { ok: false, reason: 'invalid' }
    return {
      ok: true,
      token: result.token,
      expiresAt: new Date(result.exp * 1000),
      locale: user?.locale === 'ar' ? 'ar' : 'en',
    }
  } catch (error) {
    // Payload answers 401 for both a wrong password and a locked account, and a bundler may hold
    // its own copy of Payload's error classes (so no `instanceof`): on a 401, the account's lock
    // stamp says which it was.
    if ((error as { status?: unknown } | null)?.status !== UNAUTHORIZED) throw error
    return { ok: false, reason: (await lockedUntil(payload, email)) ? 'locked' : 'invalid' }
  }
}

/** When a company user's sign-in lock ends, if it is locked now. */
async function lockedUntil(payload: Payload, email: string): Promise<Date | null> {
  const found = await payload.find({
    collection: PARTNER_COLLECTION,
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    showHiddenFields: true,
    // System read: the lock stamp is auth bookkeeping no user may read; nothing else leaves.
    overrideAccess: true,
  })
  const until = (found.docs[0] as { lockUntil?: string | null } | undefined)?.lockUntil
  const at = until ? new Date(until) : null
  return at && at.getTime() > Date.now() ? at : null
}

/** Ends the user's current session (the one in their token). A no-op for anyone else. */
export async function signOutPartner(payload: Payload, user: unknown): Promise<void> {
  if (!isCompanyUser(user as { collection?: string } | null)) return
  const collection = payload.collections[PARTNER_COLLECTION]
  if (!collection) throw new Error(`The ${PARTNER_COLLECTION} collection is not configured`)
  const req = await createLocalReq({ user: user as never }, payload) // reason: the authenticated user from payload.auth
  await logoutOperation({ collection, req })
}

/** The auth cookie's name in this app (`<cookiePrefix>-token`, Payload's convention). */
export const partnerCookieName = (payload: Payload): string =>
  `${payload.config.cookiePrefix}-token`

/** `Set-Cookie` for a session: httpOnly, SameSite=Lax, Secure on https, until the token expires. */
export function partnerCookie(
  payload: Payload,
  session: { token: string; expiresAt: Date } | null,
  secure: boolean,
): string {
  return [
    `${partnerCookieName(payload)}=${session ? session.token : ''}`,
    'Path=/',
    session ? `Expires=${session.expiresAt.toUTCString()}` : 'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}
