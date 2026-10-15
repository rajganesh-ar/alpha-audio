/**
 * Customer sign-in rules (docs/tasks/0012; spec: Security → Customers sign in with an email
 * magic link, or a verified mobile once an SMS/WhatsApp provider exists). Pure, so they are
 * unit tested; the Postgres side lives in `@alpha/payload` (system/accounts).
 */

/** A sign-in link works once, for 15 minutes. */
export const SIGN_IN_TTL_MS = 15 * 60 * 1000
/** A session lasts 30 days from sign-in. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** Links one address may request per hour, and one network address. */
export const MAX_SIGN_IN_PER_EMAIL_PER_HOUR = 5
export const MAX_SIGN_IN_PER_IP_PER_HOUR = 20

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Lower case and trimmed, or null when it cannot be an address. */
export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}

export type SignInLimit = 'ok' | 'email-limit' | 'ip-limit'

export function signInLimit(recent: { forEmail: number; forIp: number }): SignInLimit {
  if (recent.forEmail >= MAX_SIGN_IN_PER_EMAIL_PER_HOUR) return 'email-limit'
  if (recent.forIp >= MAX_SIGN_IN_PER_IP_PER_HOUR) return 'ip-limit'
  return 'ok'
}

export type LinkState = 'valid' | 'expired' | 'used' | 'unknown'

export function linkState(
  link: { expiresAt: Date; usedAt: Date | null } | null,
  now: Date,
): LinkState {
  if (!link) return 'unknown'
  if (link.usedAt) return 'used'
  return link.expiresAt.getTime() <= now.getTime() ? 'expired' : 'valid'
}
