/**
 * Response helpers for the partners API and forms. Every response is per-company (CLAUDE.md
 * rule 4); next.config.mjs sets the same headers on pages.
 */
export const PRIVATE = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
} as const

/** JSON with bigint amounts as strings (money is minor units in a bigint). */
export const json = (body: unknown, status = 200): Response =>
  new Response(
    JSON.stringify(body, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
    { status, headers: { ...PRIVATE, 'Content-Type': 'application/json' } },
  )

export const problem = (status: number, code: string, message: string, detail?: unknown) =>
  json(
    detail === undefined ? { error: { code, message } } : { error: { code, message, detail } },
    status,
  )

/** `303 See Other` to a path on this site, with optional cookies. */
export function seeOther(location: string, cookies: readonly string[] = []): Response {
  const headers = new Headers({ ...PRIVATE, Location: location })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 303, headers })
}

/** A browser on another site cannot post here with the dealer's cookie (Origin, Sec-Fetch-Site). */
export function crossSite(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true
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

export const isForm = (request: Request): boolean => {
  const type = request.headers.get('content-type') ?? ''
  return (
    type.startsWith('application/x-www-form-urlencoded') || type.startsWith('multipart/form-data')
  )
}

/** The body as fields (form) or an object (JSON); null when unreadable. */
export async function readFields(request: Request): Promise<Record<string, unknown> | null> {
  try {
    if (isForm(request)) {
      const fields: Record<string, unknown> = {}
      for (const [key, value] of await request.formData())
        if (typeof value === 'string') fields[key] = value
      return fields
    }
    const text = await request.text()
    const body: unknown = text.trim() ? JSON.parse(text) : {}
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
