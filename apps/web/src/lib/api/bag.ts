import type { Payload } from 'payload'
import { z } from 'zod'
import { MAX_BAG_LINES, MAX_LINE_QTY, updateBag } from '@alpha/core'
import {
  LOCALE_CODES,
  getMarketsCached,
  loadCart,
  resolveMarketRoute,
  saveCart,
} from '@alpha/payload'
import { lookupCatalog } from '@/lib/commerce/catalog'
import { snapshotLines } from '@/lib/commerce/bag'
import { bagCookie, bagCookieHeader, readCookie } from '@/lib/commerce/cookies'
import { localizedPath, siteUrl } from '@/lib/seo'
import { crossSite, json, problem } from './respond'
import { isForm, readFields, seeOther, withQuery } from './forms'

export const SKU = /^[A-Z0-9][A-Z0-9-]{0,63}$/

const BagLineBody = z.object({
  sku: z.string().regex(SKU),
  qty: z.coerce.number().int().min(0).max(MAX_LINE_QTY),
  mode: z.enum(['add', 'set']).default('add'),
  locale: z.enum(LOCALE_CODES),
})

export type BagStatus = 'added' | 'updated' | 'removed' | 'not-on-sale' | 'full' | 'error'

/**
 * `POST /api/v1/markets/{market}/bag/lines`: add a product, change a quantity, or remove a
 * line (`qty=0`, `mode=set`). The bag is the cart behind the httpOnly cookie for this market;
 * prices are never taken from the request. A form post answers 303 to the bag page.
 */
export async function postBagLine(
  payload: Payload,
  request: Request,
  market: string,
  now: Date = new Date(),
): Promise<Response> {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const form = isForm(request)
  const fields = await readFields(request)
  const parsed = BagLineBody.safeParse(fields ?? {})
  const locale = typeof fields?.['locale'] === 'string' ? fields['locale'] : ''
  const route = resolveMarketRoute(await getMarketsCached(payload), market, locale)
  if (!route) return problem(404, 'unknown-market', 'No such market.')
  const bagPath = localizedPath(route.market.code, route.locale, '/bag')
  const answer = (status: BagStatus, cookies: string[] = [], code = 200) =>
    form
      ? seeOther(withQuery(bagPath, { status }), cookies)
      : withCookies(json({ status }, code), cookies)

  if (!parsed.success) {
    return form
      ? answer('error')
      : problem(400, 'invalid-request', 'The request is invalid.', parsed.error.flatten())
  }
  const change = parsed.data
  const token = readCookie(request, bagCookie(route.market.code))
  const cart = await loadCart(payload, token, route.market.code, now)
  const current = cart?.lines ?? []

  const isNew = !current.some((i) => i.sku === change.sku)
  if (change.mode === 'add' && change.qty < 1) return answer('error', [], 400)
  if (isNew && change.qty > 0) {
    const hit = (await lookupCatalog(payload, [change.sku], route, now)).get(change.sku)
    if (!hit?.entry.onSale || hit.entry.price.kind !== 'priced')
      return answer('not-on-sale', [], 422)
  }
  const items = updateBag(current, change)
  const inBag = items.some((i) => i.sku === change.sku)
  if (change.qty > 0 && !inBag && current.length >= MAX_BAG_LINES) return answer('full', [], 422)
  if (!cart && items.length === 0) return answer('removed')

  const catalog = await lookupCatalog(
    payload,
    items.map((i) => i.sku),
    route,
    now,
  )
  const saved = await saveCart(
    payload,
    {
      cart,
      token,
      market: route.market.code,
      locale: route.locale,
      lines: snapshotLines(items, catalog),
    },
    now,
  )
  const cookie = bagCookieHeader(route.market.code, saved.token, siteUrl().protocol === 'https:')
  const status: BagStatus = change.mode === 'add' ? 'added' : inBag ? 'updated' : 'removed'
  return answer(status, [cookie])
}

function withCookies(response: Response, cookies: readonly string[]): Response {
  for (const cookie of cookies) response.headers.append('Set-Cookie', cookie)
  return response
}
