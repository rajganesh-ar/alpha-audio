import type { Payload } from 'payload'
import { LOCALE_CODES, getMarketsCached, resolveMarketRoute, submitEnquiry } from '@alpha/payload'
import { localizedPath } from '@/lib/seo'
import { clientIp } from './account'
import { readFields, seeOther, withQuery } from './forms'
import { crossSite, json, problem } from './respond'

/**
 * Storefront enquiries (docs/tasks/0018, ADR 0018): `POST /api/v1/markets/{market}/leads`. A plain
 * form with a `303` answer back to the enquiry page; same-origin checked; rate-limited and
 * honeypotted in the service. JSON callers get JSON. Nothing the shopper typed is put in the URL.
 */
export async function postEnquiry(
  deps: { payload: Payload; now?: () => Date },
  request: Request,
  market: string,
): Promise<Response> {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const fields = (await readFields(request)) ?? {}
  const locale =
    typeof fields['locale'] === 'string' &&
    (LOCALE_CODES as readonly string[]).includes(fields['locale'])
      ? fields['locale']
      : ''
  const route = resolveMarketRoute(await getMarketsCached(deps.payload), market, locale)
  if (!route) return problem(404, 'unknown-market', 'No such market.')
  const slug = typeof fields['product'] === 'string' ? fields['product'].slice(0, 200) : ''
  const result = await submitEnquiry(
    deps.payload,
    {
      market: route.market.code,
      locale: route.locale,
      productSlug: slug,
      name: fields['name'],
      email: fields['email'],
      phone: fields['phone'],
      city: fields['city'],
      message: fields['message'],
      consent: fields['consent'],
      website: fields['website'],
      ip: clientIp(request),
      idempotencyKey: fields['key'],
    },
    deps.now,
  )
  const isForm = (request.headers.get('content-type') ?? '').includes('form')
  if (!isForm)
    return result.status === 'sent'
      ? json({ status: 'sent', number: result.number || null })
      : problem(
          result.status === 'not-found' ? 404 : result.status === 'rate-limited' ? 429 : 400,
          result.status,
          'The enquiry was not sent.',
          result.status === 'invalid' ? { fields: result.fields } : undefined,
        )
  const page = localizedPath(route.market.code, route.locale, '/enquire')
  return seeOther(
    withQuery(page, {
      product: slug,
      status: result.status,
      ...(result.status === 'invalid' ? { fields: result.fields.join(',') } : {}),
    }),
  )
}
