import { createHash, randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import {
  ADDRESS_FIELDS,
  CONTACT_FIELDS,
  isAddressScheme,
  validateDetails,
  type PaymentProvider,
} from '@alpha/core'
import {
  SANDBOX_SIGNATURE_HEADER,
  SandboxPaymentProvider,
  convertCartForOrder,
  createCheckout,
  getMarketsCached,
  hashToken,
  linkCartOrder,
  orderAccessToken,
  queueNotification,
  loadCart,
  resolveMarketRoute,
  saveCart,
  type MarketRoute,
} from '@alpha/payload'
import { priceCart } from '@/lib/commerce/bag'
import { bagCookie, readCookie } from '@/lib/commerce/cookies'
import { paymentProvider } from '@/lib/commerce/payments'
import { FORM_KEY, idempotencyKey } from '@/lib/commerce/tokens'
import { localizedPath, siteUrl } from '@/lib/seo'
import { crossSite, json, problem } from './respond'
import { readFields, seeOther, withQuery } from './forms'

/** Fields the checkout form may carry back into the draft (to refill the form). */
export const DRAFT_FIELDS = [...CONTACT_FIELDS, ...ADDRESS_FIELDS, 'method'] as const

export interface CheckoutDeps {
  payload: Payload
  now?: () => Date
  /** The provider for a route; defaults to the environment's (`PAYMENT_PROVIDER`). */
  provider?: (route: MarketRoute) => PaymentProvider | null
}

export const checkoutPaths = (route: MarketRoute) => {
  const at = (path: string) => localizedPath(route.market.code, route.locale, path)
  return {
    bag: at('/bag'),
    checkout: at('/checkout'),
    result: at('/checkout/return'),
    sandbox: (intent: string) => at(`/checkout/sandbox/${intent}`),
  }
}

/** The environment's provider, its hosted page under this market and locale. */
export const defaultProvider = (route: MarketRoute): PaymentProvider | null =>
  paymentProvider((intent, query) => `${checkoutPaths(route).sandbox(intent)}?${query}`)

/** Payment rails offered: the market's (Markets record) that the provider can take. */
export const offeredMethods = (route: MarketRoute, provider: PaymentProvider | null): string[] =>
  provider ? route.market.payments.filter((m) => provider.methods.includes(m)) : []

/**
 * `POST /api/v1/markets/{market}/checkout` (form). Validates the details against the market's
 * address scheme, prices the bag from the catalogue, then runs `CheckoutService.start`: all
 * lines are held for 15 minutes or none, one order per idempotency key, and the shopper is sent
 * to the provider's payment page. Every refusal returns to the page that explains it.
 */
export async function postCheckout(
  deps: CheckoutDeps,
  request: Request,
  market: string,
): Promise<Response> {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const { payload } = deps
  const now = deps.now ?? (() => new Date())
  const fields = (await readFields(request)) ?? {}
  const locale = typeof fields['locale'] === 'string' ? fields['locale'] : ''
  const route = resolveMarketRoute(await getMarketsCached(payload), market, locale)
  if (!route) return problem(404, 'unknown-market', 'No such market.')
  const paths = checkoutPaths(route)
  const back = (status: string, extra: Record<string, readonly string[]> = {}) =>
    seeOther(withQuery(paths.checkout, { status, ...extra }))

  const token = readCookie(request, bagCookie(route.market.code))
  const cart = await loadCart(payload, token, route.market.code, now())
  if (!cart || !token || cart.lines.length === 0) return seeOther(paths.bag)

  const draft = Object.fromEntries(
    DRAFT_FIELDS.flatMap((name) => {
      const value = fields[name]
      return typeof value === 'string' ? [[name, value.slice(0, 300)]] : []
    }),
  )
  await saveCart(payload, {
    cart,
    token,
    market: route.market.code,
    locale: route.locale,
    draft,
  })

  const formKey = typeof fields['key'] === 'string' ? fields['key'] : ''
  if (!FORM_KEY.test(formKey)) return back('expired')
  const scheme = route.market.addressScheme
  const details = isAddressScheme(scheme) ? validateDetails(scheme, fields) : null
  const provider = (deps.provider ?? defaultProvider)(route)
  const methods = offeredMethods(route, provider)
  if (!provider || methods.length === 0 || !details) return back('no-payments')
  const method = typeof fields['method'] === 'string' ? fields['method'] : ''
  if (!details.ok || !methods.includes(method)) return back('invalid')

  const { bag } = await priceCart(payload, route, cart, now())
  if (bag.problems.length || bag.lines.length === 0)
    return seeOther(withQuery(paths.bag, { status: 'bag-invalid' }))

  const key = idempotencyKey(cart.id, formKey, bag)
  const access = orderAccessToken(payload, key)
  const resultUrl = (number: string) => withQuery(paths.result, { order: number, token: access })
  const result = await createCheckout(payload, provider, now).start({
    market: route.market.code,
    bag,
    idempotencyKey: key,
    method,
    locale: route.locale,
    returnUrl: (number) => new URL(resultUrl(number), siteUrl()).toString(),
    details: {
      ...details.details,
      paymentMethod: method,
      locale: route.locale,
      accessTokenHash: hashToken(access),
    },
  })
  if (result.order) await linkCartOrder(payload, cart.id, Number(result.order.id))

  if (result.ok) return seeOther(result.redirectUrl)
  switch (result.reason) {
    case 'bag-invalid':
      return seeOther(withQuery(paths.bag, { status: 'bag-invalid' }))
    case 'unavailable':
      return back('unavailable', { sku: result.skus })
    case 'payment-error':
      return back('payment-error')
    case 'in-progress':
      return seeOther(resultUrl(result.order.number))
    case 'already-closed':
      return result.order.status === 'confirmed'
        ? seeOther(resultUrl(result.order.number))
        : back('already-closed')
  }
}

/**
 * `POST /api/webhooks/{provider}`: a payment event from the provider. Not same-origin checked
 * (the provider's servers call it); the provider's signature is the check. Deduplicated by event
 * id, so a replay changes nothing. A confirmed order closes the shopper's cart.
 */
export async function postWebhook(
  deps: Omit<CheckoutDeps, 'provider'> & { provider?: () => PaymentProvider | null },
  request: Request,
  providerId: string,
): Promise<Response> {
  const provider = (deps.provider ?? (() => paymentProvider()))()
  if (!provider || provider.id !== providerId)
    return problem(404, 'unknown-provider', 'No such payment provider.')
  const raw = await request.text()
  const headers = Object.fromEntries(request.headers)
  const event = provider.parseWebhook(raw, headers)
  if (!event) return problem(401, 'invalid-signature', 'The event is not authentic.')
  const payloadHash = createHash('sha256').update(raw).digest('hex')
  const result = await createCheckout(deps.payload, provider, deps.now).handlePaymentEvent(
    event,
    payloadHash,
  )
  if (result.outcome === 'confirmed' && result.order) {
    await convertCartForOrder(deps.payload, Number(result.order.id))
    await queueNotification(deps.payload, Number(result.order.id), 'order-confirmed')
  }
  return json({ outcome: result.outcome })
}

/**
 * `POST /api/v1/markets/{market}/checkout/sandbox/{intent}` (form, sandbox only): the hosted
 * test page's Pay or Decline. It signs the event as the gateway would, delivers it to the
 * webhook handler, and returns the shopper to the order's result page.
 */
export async function postSandboxPayment(
  deps: Omit<CheckoutDeps, 'provider'> & { provider?: () => PaymentProvider | null },
  request: Request,
  intentId: string,
): Promise<Response> {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const provider = (deps.provider ?? (() => paymentProvider()))()
  if (!(provider instanceof SandboxPaymentProvider))
    return problem(404, 'unknown-provider', 'The sandbox is not enabled.')
  const fields = (await readFields(request)) ?? {}
  const action = fields['action']
  const query = typeof fields['q'] === 'string' ? fields['q'] : ''
  const intent = provider.readIntent(intentId, new URLSearchParams(query))
  if (!intent || (action !== 'pay' && action !== 'decline'))
    return problem(400, 'invalid-request', 'This payment link is not valid.')
  const { body, signature } = provider.event(
    intentId,
    action === 'pay' ? 'captured' : 'declined',
    intent.amount,
    `evt_${randomUUID()}`,
  )
  const delivered = await postWebhook(
    { ...deps, provider: () => provider },
    new Request(new URL(`/api/webhooks/${provider.id}`, siteUrl()), {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', [SANDBOX_SIGNATURE_HEADER]: signature },
    }),
    provider.id,
  )
  if (!delivered.ok) return delivered
  const target = new URL(intent.returnUrl, siteUrl())
  if (target.origin !== siteUrl().origin)
    return problem(400, 'invalid-request', 'This payment link is not valid.')
  return seeOther(`${target.pathname}${target.search}`)
}
