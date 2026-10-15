import type { Id } from '../ledger/types'

/** Lead states (docs/tasks/0018). `routing` is the short claim while the next recipient is chosen. */
export const LEAD_STATUSES = [
  'new',
  'routing',
  'offered',
  'accepted',
  'with-alpha',
  'closed',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_SOURCES = ['request-price', 'specialist'] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export const LEAD_OUTCOMES = ['won', 'lost'] as const
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number]

/** How long an offered company has to accept (spec: `acceptBy = createdAt + 24 h`). */
export const ACCEPT_WINDOW_MS = 24 * 60 * 60 * 1000

export interface LeadAttempt {
  company: Id
  offeredAt: Date
  acceptBy: Date
  result: 'pending' | 'accepted' | 'declined' | 'expired'
}

export interface LeadRecord {
  id: Id
  number: string
  market: string
  status: LeadStatus
  /** From the brand's agreement in the market (ADR 0008): `alpha` keeps leads with Alpha. */
  routing: 'alpha' | 'dealer'
  city: string | null
  offeredTo: Id | null
  acceptBy: Date | null
  attempts: LeadAttempt[]
  outcome: LeadOutcome | null
  /** Won value, minor units of the market currency. */
  value: bigint | null
}

export type NewLead = Omit<LeadRecord, 'id'> & {
  /** Request key (one per form submission). */
  idempotencyKey: string
  /** Contact, product, brand, message, locale: stored as the app shapes them. */
  details: Readonly<Record<string, unknown>>
}

export type LeadPatch = Partial<
  Pick<LeadRecord, 'offeredTo' | 'acceptBy' | 'attempts' | 'outcome' | 'value'>
>

/** A company that may receive leads in the lead's market. */
export interface LeadCandidate {
  id: Id
  /** Cities the company serves, as typed by staff. */
  territories: readonly string[]
  /** Leads currently offered to or accepted by it and not closed. */
  openLeads: number
}

export interface LeadStore {
  /** `L-AE-2026-000123`, from a database sequence. */
  nextLeadNumber(market: string, now: Date): Promise<string>
  findByNumber(number: string): Promise<LeadRecord | null>
  insertLead(lead: NewLead): Promise<{ lead: LeadRecord; created: boolean }>
  transition(
    id: Id,
    from: readonly LeadStatus[],
    to: LeadStatus,
    patch?: LeadPatch,
  ): Promise<boolean>
  /** Offered leads whose acceptance deadline passed at or before `now`. */
  listExpiredOffers(now: Date, limit: number): Promise<LeadRecord[]>
}

/** Enquiries one email address, and one IP, may send per hour (a guard against floods). */
export const MAX_LEADS_PER_EMAIL_PER_HOUR = 5
export const MAX_LEADS_PER_IP_PER_HOUR = 20

export function leadLimit(recent: { forEmail: number; forIp: number }): 'ok' | 'limited' {
  return recent.forEmail >= MAX_LEADS_PER_EMAIL_PER_HOUR ||
    recent.forIp >= MAX_LEADS_PER_IP_PER_HOUR
    ? 'limited'
    : 'ok'
}
