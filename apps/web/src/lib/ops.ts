import { headers } from 'next/headers'
import { getPayload, type Payload, type TypedUser } from 'payload'
import config from '@payload-config'
import { getDictionary, translator, type Translate } from '@alpha/ui'

/**
 * The staff ops screens (docs/tasks/0010). English for now: staff work in English, and every
 * string still comes from the dictionary, so an Arabic ops UI is a locale switch away.
 */
export const OPS_LOCALE = 'en' as const
export const opsCopy = (): Translate => translator(getDictionary(OPS_LOCALE))

export type StaffUser = TypedUser & { collection: 'users' }

/** The signed-in staff member (Payload session cookie), or null. */
export async function staffSession(): Promise<{ payload: Payload; user: StaffUser | null }> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  return { payload, user: user?.collection === 'users' ? (user as StaffUser) : null }
}

export const loginPath = (back: string) => `/admin/login?redirect=${encodeURIComponent(back)}`

/** Formats an ISO timestamp for staff, in the market's timezone. */
export function opsDate(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
    numberingSystem: 'latn',
  }).format(new Date(iso))
}
