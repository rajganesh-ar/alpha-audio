import type { GlobalAfterChangeHook } from 'payload'
import { invalidateMarketsCache } from '../markets/read'

/**
 * After the Markets global changes (a market goes live, VAT changes), drop this process's
 * cached copy (shared by the proxy and the app) and purge every rendered storefront page so it re-renders with the new record.
 *
 * `revalidatePath` is used rather than `revalidateTag`: in Next.js 16 `revalidateTag` serves
 * stale data by default, and a VAT rate or market status must not be served stale.
 *
 * Scripts outside a Next.js request (seeds, `payload run`) pass `context.disableRevalidate`;
 * Next throws if revalidatePath is called with no request.
 */
export const revalidateMarkets: GlobalAfterChangeHook = async ({ doc, req }) => {
  invalidateMarketsCache()
  if (req.context['disableRevalidate']) return doc
  const { revalidatePath } = await import('next/cache')
  revalidatePath('/', 'layout')
  return doc
}
