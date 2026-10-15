/**
 * Brand rights per market (spec: GCC market layer). What Alpha may sell where comes from
 * `BrandAgreements`; a product's own "published" flag is necessary but not sufficient.
 */

export const AGREEMENT_ROLES = ['distributor', 'retailer', 'none'] as const
export type AgreementRole = (typeof AGREEMENT_ROLES)[number]

export const LEAD_ROUTINGS = ['alpha', 'dealer'] as const
export type LeadRouting = (typeof LEAD_ROUTINGS)[number]

/** Compliance flags; the blocking ones hide the brand in the market and stop sales into it. */
export const COMPLIANCE_FLAGS = [
  'origin-restriction',
  'registration-pending',
  'arabic-labelling',
  'wireless-type-approval',
] as const
export type ComplianceFlag = (typeof COMPLIANCE_FLAGS)[number]
export const BLOCKING_FLAGS: ReadonlySet<ComplianceFlag> = new Set([
  'origin-restriction',
  'registration-pending',
])

export interface Agreement {
  id?: string | number | undefined
  brand: string | number
  market: string
  role: AgreementRole
  exclusive: boolean
  /** Inclusive; null means "since always". */
  validFrom: Date | null
  /** Exclusive; null means open-ended. */
  validTo: Date | null
  leadRouting: LeadRouting
  complianceFlags: readonly ComplianceFlag[]
}

export function isLive(agreement: Agreement, now: Date): boolean {
  if (agreement.role === 'none') return false
  if (agreement.validFrom && now < agreement.validFrom) return false
  if (agreement.validTo && now >= agreement.validTo) return false
  return !agreement.complianceFlags.some((flag) => BLOCKING_FLAGS.has(flag))
}

const rank = (a: Agreement) => (a.role === 'distributor' ? 2 : 0) + (a.exclusive ? 1 : 0)

/** The agreement under which a brand is sold in a market now, or null when it is not. */
export function liveAgreement(
  agreements: readonly Agreement[],
  brand: string | number,
  market: string,
  now: Date,
): Agreement | null {
  const live = agreements.filter(
    (a) => String(a.brand) === String(brand) && a.market === market && isLive(a, now),
  )
  return live.sort((a, b) => rank(b) - rank(a))[0] ?? null
}

/** Whether two agreements for the same brand and market share any instant. */
export function overlaps(a: Agreement, b: Agreement): boolean {
  if (String(a.brand) !== String(b.brand) || a.market !== b.market) return false
  const startsBeforeOtherEnds = (x: Agreement, y: Agreement) =>
    !y.validTo || !x.validFrom || x.validFrom < y.validTo
  return startsBeforeOtherEnds(a, b) && startsBeforeOtherEnds(b, a)
}

export type AgreementProblem = 'ends-before-start' | 'overlaps'

/** Problems with saving `candidate` next to `existing` (the candidate itself excluded by id). */
export function agreementProblems(
  candidate: Agreement,
  existing: readonly Agreement[],
): AgreementProblem[] {
  const problems: AgreementProblem[] = []
  if (candidate.validFrom && candidate.validTo && candidate.validTo <= candidate.validFrom)
    problems.push('ends-before-start')
  const others = existing.filter(
    (e) => candidate.id === undefined || String(e.id) !== String(candidate.id),
  )
  if (others.some((e) => overlaps(candidate, e))) problems.push('overlaps')
  return problems
}

/** Brand ids with a live agreement in a market. */
export function brandsWithRights(
  agreements: readonly Agreement[],
  market: string,
  now: Date,
): Set<string> {
  return new Set(
    agreements.filter((a) => a.market === market && isLive(a, now)).map((a) => String(a.brand)),
  )
}
