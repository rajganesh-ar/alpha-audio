import type { Payload } from 'payload'
import { LEGACY_REDIRECTS_SLUG } from '../collections/LegacyRedirects'
import { normalizeLegacyPath, normalizeLegacyQuery } from './normalize'

export interface LegacyRedirect {
  target: string
  status: 301 | 302
}

/**
 * Looks up an old-site URL in LegacyRedirects. The table is public by nature (anyone can follow
 * a redirect), so it is read with normal access rules and no user.
 */
export async function resolveLegacyRedirect(
  payload: Payload,
  url: URL,
): Promise<LegacyRedirect | null> {
  const query = normalizeLegacyQuery(url.searchParams)
  // A path-only redirect may be stored with an empty or a null query; match either.
  const queryMatch =
    query === ''
      ? { or: [{ sourceQuery: { equals: '' } }, { sourceQuery: { exists: false } }] }
      : { sourceQuery: { equals: query } }
  const { docs } = await payload.find({
    collection: LEGACY_REDIRECTS_SLUG,
    where: { and: [{ sourcePath: { equals: normalizeLegacyPath(url.pathname) } }, queryMatch] },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  const doc = docs[0] as { target?: unknown; status?: unknown } | undefined
  if (!doc || typeof doc.target !== 'string') return null
  return { target: doc.target, status: doc.status === '302' ? 302 : 301 }
}
