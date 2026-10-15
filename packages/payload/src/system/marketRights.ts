import type { Payload } from 'payload'
import { BLOCKING_FLAGS } from '@alpha/core'
import { toAgreement } from '../collections/catalog/BrandAgreements'

/**
 * The public face of brand agreements: for each agreement, the brand, market and the window in
 * which it lets the brand be sold. Role details, exclusivity, lead routing and notes stay in the
 * staff-only collection.
 */
export interface RightsWindow {
  brand: string
  market: string
  /** ISO 8601 or null. */
  from: string | null
  to: string | null
}

export async function loadRightsWindows(payload: Payload): Promise<RightsWindow[]> {
  const { docs } = await payload.find({
    collection: 'brand-agreements',
    limit: 10_000,
    depth: 0,
    pagination: false,
    // Agreements are staff-only, and the anonymous storefront must know which brands it may
    // show; only the projection below leaves this function.
    overrideAccess: true,
  })
  return docs
    .map(toAgreement)
    .filter((a) => a.role !== 'none' && !a.complianceFlags.some((f) => BLOCKING_FLAGS.has(f)))
    .map((a) => ({
      brand: String(a.brand),
      market: a.market,
      from: a.validFrom?.toISOString() ?? null,
      to: a.validTo?.toISOString() ?? null,
    }))
}

/** Brand ids sellable in a market at `now`, from the projection. */
export function brandsSellableIn(
  windows: readonly RightsWindow[],
  market: string,
  now: Date,
): Set<string> {
  const t = now.getTime()
  return new Set(
    windows
      .filter(
        (w) =>
          w.market === market &&
          (!w.from || Date.parse(w.from) <= t) &&
          (!w.to || t < Date.parse(w.to)),
      )
      .map((w) => w.brand),
  )
}
