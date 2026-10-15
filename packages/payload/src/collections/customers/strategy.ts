import type { AuthStrategy } from 'payload'
import { CUSTOMER_SESSION_COOKIE, customerFromSession } from '../../system/accounts'

const cookieValue = (header: string | null, name: string): string | undefined => {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

/**
 * Payload auth strategy for storefront customers (docs/tasks/0012, ADR 0012): the httpOnly
 * `alpha_session` cookie holds a random session token; its SHA-256 is looked up in
 * CustomerSessions. Gives `req.user` with `collection: 'customers'` to access functions.
 */
export const customerSessionStrategy: AuthStrategy = {
  name: 'customer-session',
  authenticate: async ({ headers, payload }) => {
    const token = cookieValue(headers.get('cookie'), CUSTOMER_SESSION_COOKIE)
    if (!token) return { user: null }
    const customer = await customerFromSession(payload, token)
    return {
      user: customer
        ? ({ ...customer, collection: 'customers', _strategy: 'customer-session' } as never)
        : null,
    }
  },
}
