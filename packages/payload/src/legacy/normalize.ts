/**
 * Normalizes the old site's URLs so a stored redirect matches however the link was shared:
 * tracking parameters are dropped, keys are lower-cased, pairs are sorted, and an empty query
 * becomes ''. `?bid=13&utm_source=x` and `?BID=13` both normalize to `bid=13`.
 */

const TRACKING_PARAM =
  /^(utm_[a-z0-9_]+|gclid|gbraid|wbraid|fbclid|msclkid|dclid|yclid|_ga|_gl|mc_cid|mc_eid)$/i

export function normalizeLegacyQuery(query: string | URLSearchParams): string {
  const params = typeof query === 'string' ? new URLSearchParams(query.replace(/^\?/, '')) : query
  const pairs: Array<[string, string]> = []
  for (const [rawKey, rawValue] of params) {
    const key = rawKey.trim().toLowerCase()
    if (!key || TRACKING_PARAM.test(key)) continue
    pairs.push([key, rawValue.trim()])
  }
  pairs.sort(([ak, av], [bk, bv]) => (ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)))
  return new URLSearchParams(pairs).toString()
}

/** Old paths are matched case-insensitively and without a trailing slash: `/Brand/` → `/brand`. */
export function normalizeLegacyPath(path: string): string {
  const withoutQuery = path.split(/[?#]/)[0] ?? ''
  const trimmed = withoutQuery.trim().toLowerCase().replace(/\/+$/, '')
  return trimmed.startsWith('/') ? trimmed || '/' : `/${trimmed}`
}

/**
 * A redirect target must be a path on this site (`/ae/en/brands/mcintosh`). Absolute URLs are
 * refused so the table can never become an open redirect.
 */
export function validateLegacyTarget(target: unknown): true | string {
  if (typeof target !== 'string' || !target) return 'Target is required.'
  if (!target.startsWith('/') || target.startsWith('//')) {
    return 'Target must be a path on this site starting with "/", such as /ae/en/brands/mcintosh.'
  }
  if (/[\s\\]/.test(target)) return 'Target must not contain spaces or backslashes.'
  return true
}

export function validateLegacyPath(path: unknown): true | string {
  if (typeof path !== 'string' || !path) return 'Source path is required.'
  if (!path.startsWith('/')) return 'Source path must start with "/", such as /brand.'
  if (/[?#]/.test(path)) return 'Put the query string in "Source query", not in the path.'
  return true
}

/**
 * Query keys that only the old site used. A request carrying one of these, on a path the new
 * site does not route, is looked up in LegacyRedirects. Everything else skips the lookup.
 */
export const LEGACY_QUERY_KEYS = ['bid', 'catid'] as const

export function hasLegacyQuery(params: URLSearchParams): boolean {
  for (const key of params.keys()) {
    if ((LEGACY_QUERY_KEYS as readonly string[]).includes(key.trim().toLowerCase())) return true
  }
  return false
}

/** Campaign parameters from the old link, kept on the redirect so attribution survives. */
export function trackingParams(params: URLSearchParams): URLSearchParams {
  const kept = new URLSearchParams()
  for (const [key, value] of params) if (TRACKING_PARAM.test(key.trim())) kept.append(key, value)
  return kept
}
