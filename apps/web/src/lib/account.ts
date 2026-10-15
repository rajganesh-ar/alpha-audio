import { cookies, headers } from 'next/headers'
import { getPayload, type Payload, type TypedUser } from 'payload'
import config from '@payload-config'
import { CUSTOMER_SESSION_COOKIE, sessionCsrf } from '@alpha/payload'
import type { Customer } from '@/payload-types'

export type SignedInCustomer = Customer & { collection: 'customers' }

/**
 * The signed-in customer for a page (docs/tasks/0012), through Payload auth (the customer
 * session strategy), and the CSRF token for forms that act on the session. Reading it makes the
 * page per-visitor, so callers are dynamic and never cached.
 */
export async function customerSession(): Promise<{
  payload: Payload
  customer: SignedInCustomer | null
  csrf: string | null
}> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const customer =
    (user as (TypedUser & { collection?: string }) | null)?.collection === 'customers'
      ? (user as unknown as SignedInCustomer)
      : null
  const session = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value
  return { payload, customer, csrf: customer && session ? sessionCsrf(payload, session) : null }
}
