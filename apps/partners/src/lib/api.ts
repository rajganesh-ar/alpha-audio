import type { Payload } from 'payload'
import { z } from 'zod'
import {
  decideTradeOrder,
  partnerCatalogue,
  partnerCookie,
  partnerLine,
  placeTradeOrder,
  resolveForSession,
  signInPartner,
  signOutPartner,
  type TradeDecision,
} from '@alpha/payload'
import { crossSite, isForm, json, problem, readFields, seeOther } from './http'
import { draftLines, reviewQuery } from './orders'

/**
 * The dealer board's handlers (docs/tasks/0014), taking their dependencies so they are easy to
 * drive from tests. Sign-in and sign-out are plain forms answering `303`; the catalogue and price
 * APIs answer JSON. The company is always the signed-in user's (CLAUDE.md rule 3).
 */
export interface Deps {
  payload: Payload
  /** Whether cookies get `Secure` (the partners origin is https). */
  secure: boolean
}

const signedIn = async (payload: Payload, request: Request) =>
  (await payload.auth({ headers: request.headers })).user

export async function postSession({ payload, secure }: Deps, request: Request) {
  if (crossSite(request)) return seeOther('/login?status=cross-site')
  const fields = await readFields(request)
  if (!fields) return seeOther('/login?status=missing')
  const result = await signInPartner(payload, {
    email: fields['email'],
    password: fields['password'],
  })
  if (!result.ok) return seeOther(`/login?status=${result.reason}`)
  return seeOther('/catalogue', [partnerCookie(payload, result, secure)])
}

export async function postSignOut({ payload, secure }: Deps, request: Request) {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const user = await signedIn(payload, request)
  if (user) await signOutPartner(payload, user)
  return seeOther('/login?status=signed-out', [partnerCookie(payload, null, secure)])
}

const catalogueQuery = z.object({
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  locale: z.enum(['en', 'ar']).optional(),
})

/** `GET /api/v1/catalogue`: the company's catalogue page with prices, trace and stock. */
export async function getCatalogue({ payload }: Deps, request: Request) {
  const user = await signedIn(payload, request)
  const params = catalogueQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!params.success)
    return problem(400, 'invalid-request', 'The request is invalid.', params.error.flatten())
  const catalogue = user
    ? await partnerCatalogue(payload, user, {
        locale: params.data.locale ?? ((user as { locale?: string }).locale === 'ar' ? 'ar' : 'en'),
        q: params.data.q,
        page: params.data.page,
      })
    : null
  if (!catalogue) return problem(401, 'unauthenticated', 'Sign in with a company account.')
  return json(catalogue)
}

const resolveBody = z.object({
  lines: z
    .array(
      z.object({
        sku: z.string().min(1).max(64),
        qty: z.number().int().min(1).max(100_000),
      }),
    )
    .min(1)
    .max(200),
})

/** `POST /api/v1/price/resolve`: the company's prices for lines, with the trace. */
export async function postResolve({ payload }: Deps, request: Request) {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const user = await signedIn(payload, request)
  if (!user) return problem(401, 'unauthenticated', 'Sign in with a company account.')
  const fields = await readFields(request)
  const body = resolveBody.safeParse(fields)
  if (!body.success)
    return problem(400, 'invalid-request', 'The request is invalid.', body.error.flatten())
  const resolved = await resolveForSession(payload, user, body.data.lines)
  if (!resolved) return problem(401, 'unauthenticated', 'Sign in with a company account.')
  return json({ lines: resolved.lines.map(partnerLine), totals: resolved.totals })
}

const orderBody = z.object({
  lines: z
    .array(z.object({ sku: z.string().min(1).max(64), qty: z.number().int() }))
    .min(1)
    .max(200),
  idempotencyKey: z.string().regex(/^[\w-]{8,100}$/),
  poNumber: z.string().max(64).optional(),
  note: z.string().max(1000).optional(),
})

/** A form post (repeated `sku` and `qty` fields) or JSON, as the order body; null when unreadable. */
async function readOrder(request: Request): Promise<unknown> {
  if (!isForm(request)) return readFields(request)
  try {
    const form = await request.formData()
    const text = (key: string) => {
      const v = form.get(key)
      return typeof v === 'string' ? v : undefined
    }
    const all = (key: string) => form.getAll(key).filter((v): v is string => typeof v === 'string')
    return {
      lines: draftLines(all('sku'), all('qty')),
      idempotencyKey: text('idempotencyKey'),
      poNumber: text('poNumber'),
      note: text('note'),
    }
  } catch {
    return null
  }
}

const userLocale = (user: unknown) =>
  (user as { locale?: string } | null)?.locale === 'ar' ? 'ar' : 'en'

/**
 * `POST /api/v1/orders`: places the signed-in company user's order, idempotent on the key. A
 * form answers 303 to the order (or back to the review with the reason); JSON answers the order.
 */
export async function postOrder({ payload }: Deps, request: Request) {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const form = isForm(request)
  const user = await signedIn(payload, request)
  if (!user) return form ? seeOther('/login') : problem(401, 'unauthenticated', 'Sign in.')
  const parsed = orderBody.safeParse(await readOrder(request))
  if (!parsed.success)
    return form
      ? seeOther('/orders/new?status=error')
      : problem(400, 'invalid-request', 'The request is invalid.', parsed.error.flatten())
  const body = parsed.data
  const result = await placeTradeOrder(payload, user, {
    lines: body.lines,
    idempotencyKey: body.idempotencyKey,
    poNumber: body.poNumber,
    note: body.note,
    locale: userLocale(user),
  })
  if (!result) return form ? seeOther('/login') : problem(401, 'unauthenticated', 'Sign in.')
  if (result.ok) {
    if (form) return seeOther(`/orders/${result.order.number}?placed=1`)
    return json({ order: result.order, created: result.created }, result.created ? 201 : 200)
  }
  if (form) {
    const extra: Record<string, string> = { status: result.reason }
    if (result.reason === 'unavailable') extra['skus'] = result.skus.join(', ')
    return seeOther(`/orders/new?${reviewQuery(body.lines, extra)}`)
  }
  const status = result.reason === 'rules' ? 422 : 409
  return problem(
    result.reason === 'not-allowed' || result.reason === 'on-hold' ? 403 : status,
    result.reason,
    'The order was not placed.',
    result.reason === 'rules'
      ? result.problems
      : result.reason === 'unavailable'
        ? { skus: result.skus }
        : undefined,
  )
}

/** `GET /api/v1/orders`: the company's orders (access scopes them to the company). */
export async function getOrders({ payload }: Deps, request: Request) {
  const user = await signedIn(payload, request)
  if (!user || (user as { collection?: string }).collection !== 'company-users')
    return problem(401, 'unauthenticated', 'Sign in with a company account.')
  const page = Number(new URL(request.url).searchParams.get('page') ?? '1')
  const orders = await payload.find({
    collection: 'trade-orders',
    user,
    overrideAccess: false,
    depth: 0,
    sort: '-createdAt',
    limit: 50,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  })
  return json(orders)
}

const DECISIONS: ReadonlyMap<string, TradeDecision> = new Map([
  ['approve', 'approve'],
  ['reject', 'reject'],
  ['cancel', 'cancel'],
])

/** `POST /api/v1/orders/{number}/{approve|reject|cancel}` for the signed-in company user. */
export async function postOrderAction(
  { payload }: Deps,
  request: Request,
  number: string,
  action: string,
) {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const form = isForm(request)
  const fields = await readFields(request)
  // The order page's one form names the decision in its pressed button (`decide`).
  const decision =
    DECISIONS.get(action === 'decide' ? String(fields?.['decision'] ?? '') : action) ?? null
  if (!decision) return problem(404, 'not-found', 'Unknown action.')
  const user = await signedIn(payload, request)
  if (!user || (user as { collection?: string }).collection !== 'company-users')
    return form ? seeOther('/login') : problem(401, 'unauthenticated', 'Sign in.')
  const note = typeof fields?.['reason'] === 'string' ? fields['reason'] : null
  const result = await decideTradeOrder(payload, user, number, decision, note)
  const outcome = result.ok
    ? decision === 'approve'
      ? 'approved'
      : decision === 'reject'
        ? 'rejected'
        : 'cancelled'
    : result.reason
  if (form) return seeOther(`/orders/${encodeURIComponent(number)}?decision=${outcome}`)
  if (result.ok) return json({ order: result.order })
  return problem(
    result.reason === 'not-found' ? 404 : result.reason === 'forbidden' ? 403 : 409,
    result.reason,
    'The decision was not recorded.',
  )
}
