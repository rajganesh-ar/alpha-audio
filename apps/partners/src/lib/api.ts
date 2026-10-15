import type { Payload } from 'payload'
import { z } from 'zod'
import {
  partnerCatalogue,
  partnerCookie,
  partnerLine,
  resolveForSession,
  signInPartner,
  signOutPartner,
} from '@alpha/payload'
import { crossSite, json, problem, readFields, seeOther } from './http'

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
