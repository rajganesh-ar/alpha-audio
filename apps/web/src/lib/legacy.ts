import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveLegacyRedirect, trackingParams } from '@alpha/payload'

export interface LegacyHit {
  location: string
  status: 301 | 302
}

/**
 * Resolves an old-site URL from LegacyRedirects. Campaign parameters on the old link are
 * carried onto the target so attribution survives the hop. Loaded lazily by the proxy, so
 * only requests that carry a legacy query pay for Payload.
 */
export async function lookupLegacy(url: URL): Promise<LegacyHit | null> {
  const hit = await resolveLegacyRedirect(await getPayload({ config }), url)
  if (!hit) return null
  const target = new URL(hit.target, url)
  for (const [key, value] of trackingParams(url.searchParams)) {
    if (!target.searchParams.has(key)) target.searchParams.append(key, value)
  }
  return { location: `${target.pathname}${target.search}`, status: hit.status }
}
