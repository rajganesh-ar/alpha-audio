import { LedgerError, ReceivingError, type ReceivingErrorCode } from '@alpha/core'
import type { Payload, TypedUser } from 'payload'
import type { z } from 'zod'

/** Every /api/v1 response is per-user: never cached by a browser, CDN or proxy (CLAUDE.md rule 4). */
const PRIVATE = { 'Cache-Control': 'private, no-store' } as const

export const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: PRIVATE })

export const problem = (
  status: number,
  code: string,
  message: string,
  detail?: unknown,
): Response =>
  json(
    detail === undefined ? { error: { code, message } } : { error: { code, message, detail } },
    status,
  )

const RECEIVING_STATUS: Partial<Record<ReceivingErrorCode, number>> = {
  'receipt-not-found': 404,
  'receipt-already-posted': 409,
  'receipt-already-put-away': 409,
  'receipt-not-posted': 409,
  'po-not-open': 409,
}

/** Maps a service refusal to a response; anything else is a bug and propagates as a 500. */
export function serviceError(error: unknown): Response {
  if (error instanceof ReceivingError) {
    return problem(RECEIVING_STATUS[error.code] ?? 422, error.code, error.message, error.detail)
  }
  if (error instanceof LedgerError) return problem(409, error.code, error.message)
  throw error
}

/** A browser on another site cannot drive ops endpoints with a staff member's cookie. */
function crossSite(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    new URL(request.url).host
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

export type Staff = TypedUser & { collection: 'users' }

/**
 * The staff member behind a request, read from the Payload session (cookie or API key), or the
 * response refusing it. Request parameters never identify the user (CLAUDE.md rule 3).
 */
export async function requireStaff(payload: Payload, request: Request): Promise<Staff | Response> {
  if (crossSite(request)) return problem(403, 'cross-site', 'Cross-site requests are refused.')
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return problem(401, 'unauthenticated', 'Sign in with a staff account.')
  if (user.collection !== 'users') return problem(403, 'forbidden', 'Staff only.')
  return user as Staff
}

/** Parses a JSON body (an empty body counts as `{}`) against a schema. */
export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | Response> {
  const text = await request.text()
  let raw: unknown = {}
  if (text.trim()) {
    try {
      raw = JSON.parse(text)
    } catch {
      return problem(400, 'invalid-json', 'The request body is not JSON.')
    }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success)
    return problem(400, 'invalid-request', 'The request is invalid.', parsed.error.flatten())
  return parsed.data as z.infer<T>
}
