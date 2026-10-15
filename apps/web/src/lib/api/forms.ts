import { PRIVATE } from './respond'

/**
 * Storefront forms work without JavaScript (docs/tasks/0009): the browser posts a form, the
 * handler answers `303 See Other` to the page that shows the result. The same handlers accept
 * JSON for scripts and tests, and answer JSON then.
 */

export const isForm = (request: Request): boolean => {
  const type = request.headers.get('content-type') ?? ''
  return (
    type.startsWith('application/x-www-form-urlencoded') || type.startsWith('multipart/form-data')
  )
}

/** The request body as string fields (form) or an object (JSON); null when unreadable. */
export async function readFields(request: Request): Promise<Record<string, unknown> | null> {
  try {
    if (isForm(request)) {
      const form = await request.formData()
      const fields: Record<string, unknown> = {}
      for (const [key, value] of form) if (typeof value === 'string') fields[key] = value
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

/** `303 See Other` to a path on this site, uncached, with optional cookies. */
export function seeOther(location: string, cookies: readonly string[] = []): Response {
  const headers = new Headers({ ...PRIVATE, Location: location })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 303, headers })
}

/** A path with query parameters (repeated keys allowed). */
export function withQuery(
  path: string,
  params: Record<string, string | readonly string[]>,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    for (const v of typeof value === 'string' ? [value] : value) search.append(key, v)
  const query = search.toString()
  return query ? `${path}?${query}` : path
}
