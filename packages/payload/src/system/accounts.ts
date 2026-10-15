import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Payload, Where } from 'payload'
import {
  SESSION_TTL_MS,
  SIGN_IN_TTL_MS,
  linkState,
  normaliseEmail,
  signInLimit,
  type LinkState,
} from '@alpha/core'
import type { LocaleCode, MarketCode } from '../markets/codes'
import { NOTIFICATIONS_QUEUE, SEND_NOTIFICATION } from './notifications'
import { seal } from './secretBox'

/**
 * Customer accounts (docs/tasks/0012, ADR 0012): email sign-in links and sessions. System code:
 * customers, sessions and links are system-written, so they are read and written here with
 * `overrideAccess: true`; nothing else may. Tokens are random 256-bit values; only their SHA-256
 * is stored.
 */

export const CUSTOMER_SESSION_COOKIE = 'alpha_session'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const token = () => randomBytes(32).toString('base64url')
const system = {
  depth: 0,
  // System code: customers, sessions and links are system-written (see the module comment).
  overrideAccess: true,
} as const
const HOUR = 60 * 60 * 1000

export interface SessionCustomer {
  id: number
  email: string
  name: string | null
  phone: string | null
  market: string
  locale: string
}

interface CustomerDoc {
  id: number
  email: string
  name?: string | null
  phone?: string | null
  market: string
  locale: string
}

const toCustomer = (doc: CustomerDoc): SessionCustomer => ({
  id: doc.id,
  email: doc.email,
  name: doc.name ?? null,
  phone: doc.phone ?? null,
  market: doc.market,
  locale: doc.locale,
})

export type SignInRequest =
  | { ok: true; notification: number | null; job: number | string | null }
  | { ok: false; reason: 'invalid-email' | 'rate-limited' }

/**
 * Emails a one-time sign-in link. Says nothing about whether the address has an account (the
 * caller always shows "check your email"). `ip` is hashed with the instance secret before it
 * is stored, and is only used to limit requests per network.
 */
export async function requestSignIn(
  payload: Payload,
  input: {
    email: unknown
    market: MarketCode
    locale: LocaleCode
    ip: string | null
    origin: string
  },
  now: Date = new Date(),
): Promise<SignInRequest> {
  const email = normaliseEmail(input.email)
  if (!email) return { ok: false, reason: 'invalid-email' }
  const ipHash = input.ip
    ? createHmac('sha256', payload.secret).update(input.ip).digest('hex')
    : null
  const since = new Date(now.getTime() - HOUR).toISOString()
  const count = (where: Where) =>
    payload
      .count({
        collection: 'sign-in-links',
        where: { and: [where, { createdAt: { greater_than: since } }] },
        // System read: sign-in links are system only.
        overrideAccess: true,
      })
      .then((r) => r.totalDocs)
  const [forEmail, forIp] = await Promise.all([
    count({ email: { equals: email } }),
    ipHash ? count({ ipHash: { equals: ipHash } }) : Promise.resolve(0),
  ])
  if (signInLimit({ forEmail, forIp }) !== 'ok') return { ok: false, reason: 'rate-limited' }

  const raw = token()
  const link = await payload.create({
    collection: 'sign-in-links',
    data: {
      tokenHash: sha256(raw),
      email,
      market: input.market,
      locale: input.locale,
      ipHash,
      expiresAt: new Date(now.getTime() + SIGN_IN_TTL_MS).toISOString(),
    },
    ...system,
  })
  const url = `${input.origin.replace(/\/$/, '')}/${input.market}/${input.locale}/account/verify/?token=${raw}`
  const existing = (
    await payload.find({
      collection: 'customers',
      where: { email: { equals: email } },
      limit: 1,
      ...system,
    })
  ).docs[0]
  const notification = await payload.create({
    collection: 'notifications',
    data: {
      key: `sign-in:${link.id}`,
      template: 'sign-in',
      channel: 'email',
      locale: input.locale,
      to: email,
      customer: existing ? Number(existing.id) : null,
      secret: seal(payload, url),
      status: 'queued',
      attempts: 0,
    },
    ...system,
  })
  const job = await payload.jobs.queue({
    task: SEND_NOTIFICATION,
    input: { notification: notification.id },
    queue: NOTIFICATIONS_QUEUE,
  })
  return { ok: true, notification: Number(notification.id), job: job.id ?? null }
}

export type SignInResult =
  | { ok: true; customer: SessionCustomer; session: string; expiresAt: Date; created: boolean }
  | { ok: false; reason: Exclude<LinkState, 'valid'> }

/**
 * Exchanges a sign-in link for a session: the link is used once (compare-and-set on `usedAt`),
 * the customer is created on first sign-in, and a new session token is returned for the cookie.
 */
export async function completeSignIn(
  payload: Payload,
  raw: string,
  now: Date = new Date(),
): Promise<SignInResult> {
  const { docs } = await payload.find({
    collection: 'sign-in-links',
    where: { tokenHash: { equals: sha256(raw) } },
    limit: 1,
    ...system,
  })
  const link = docs[0]
  const state = linkState(
    link
      ? { expiresAt: new Date(link.expiresAt), usedAt: link.usedAt ? new Date(link.usedAt) : null }
      : null,
    now,
  )
  if (state !== 'valid' || !link)
    return { ok: false, reason: state === 'valid' ? 'unknown' : state }
  // Use the link once: a concurrent second click loses this update.
  const claimed = await payload.update({
    collection: 'sign-in-links',
    where: { and: [{ id: { equals: link.id } }, { usedAt: { exists: false } }] },
    data: { usedAt: now.toISOString() },
    ...system,
  })
  if (claimed.docs.length !== 1) return { ok: false, reason: 'used' }

  const found = (
    await payload.find({
      collection: 'customers',
      where: { email: { equals: link.email } },
      limit: 1,
      ...system,
    })
  ).docs[0]
  let customer = found
  if (!customer) {
    try {
      customer = await payload.create({
        collection: 'customers',
        data: {
          email: link.email,
          market: link.market,
          locale: link.locale,
          lastSignInAt: now.toISOString(),
        },
        ...system,
      })
    } catch (error) {
      // Two links for a new address used at once: the unique email means one customer.
      customer = (
        await payload.find({
          collection: 'customers',
          where: { email: { equals: link.email } },
          limit: 1,
          ...system,
        })
      ).docs[0]
      if (!customer) throw error
    }
  } else {
    await payload.update({
      collection: 'customers',
      id: customer.id,
      data: { lastSignInAt: now.toISOString() },
      ...system,
    })
  }
  const session = token()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
  await payload.create({
    collection: 'customer-sessions',
    data: { tokenHash: sha256(session), customer: customer.id, expiresAt: expiresAt.toISOString() },
    ...system,
  })
  return {
    ok: true,
    customer: toCustomer(customer as unknown as CustomerDoc),
    session,
    expiresAt,
    created: !found,
  }
}

/** The customer behind a session token, if the session is live. Used by the auth strategy. */
export async function customerFromSession(
  payload: Payload,
  raw: string,
  now: Date = new Date(),
): Promise<SessionCustomer | null> {
  const { docs } = await payload.find({
    collection: 'customer-sessions',
    where: {
      and: [
        { tokenHash: { equals: sha256(raw) } },
        { expiresAt: { greater_than: now.toISOString() } },
        { revokedAt: { exists: false } },
      ],
    },
    limit: 1,
    depth: 1,
    // System read: the auth strategy resolves the session before any user exists.
    overrideAccess: true,
  })
  const customer = docs[0]?.customer
  return customer && typeof customer === 'object' ? toCustomer(customer as CustomerDoc) : null
}

/** Ends a session (sign out). */
export async function endSession(
  payload: Payload,
  raw: string,
  now: Date = new Date(),
): Promise<void> {
  await payload.update({
    collection: 'customer-sessions',
    where: { tokenHash: { equals: sha256(raw) } },
    data: { revokedAt: now.toISOString() },
    ...system,
  })
}

/**
 * A CSRF token for forms that act on a session (sign out): an HMAC of the session token, so it
 * is per-session and needs no storage (spec: Security → CSRF tokens on state-changing requests).
 */
export function sessionCsrf(payload: Pick<Payload, 'secret'>, session: string): string {
  return createHmac('sha256', payload.secret).update(`csrf\n${session}`).digest('base64url')
}

export function checkSessionCsrf(
  payload: Pick<Payload, 'secret'>,
  session: string,
  given: unknown,
): boolean {
  if (typeof given !== 'string') return false
  const a = Buffer.from(sessionCsrf(payload, session))
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}
