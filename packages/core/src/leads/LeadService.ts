import type { Id } from '../ledger/types'
import {
  ACCEPT_WINDOW_MS,
  type LeadAttempt,
  type LeadCandidate,
  type LeadOutcome,
  type LeadRecord,
  type LeadStore,
  type NewLead,
} from './types'

const city = (value: string) => value.trim().toLocaleLowerCase('en')

/**
 * Who answers a lead next (spec: routed by `BrandAgreements.leadRouting` then territory). Alpha
 * when the agreement keeps leads with Alpha or no untried company is left; otherwise the untried
 * company serving the lead's city, then the one with the fewest open leads, then the lowest id.
 */
export function nextRecipient(
  lead: Pick<LeadRecord, 'routing' | 'city'>,
  candidates: readonly LeadCandidate[],
  tried: ReadonlySet<string>,
): { kind: 'alpha' } | { kind: 'company'; id: Id } {
  if (lead.routing === 'alpha') return { kind: 'alpha' }
  const want = lead.city ? city(lead.city) : null
  const ranked = candidates
    .filter((c) => !tried.has(String(c.id)))
    .map((c) => ({ c, local: want !== null && c.territories.some((t) => city(t) === want) }))
    .sort(
      (a, b) =>
        Number(b.local) - Number(a.local) ||
        a.c.openLeads - b.c.openLeads ||
        String(a.c.id).localeCompare(String(b.c.id), 'en', { numeric: true }),
    )
  const first = ranked[0]
  return first ? { kind: 'company', id: first.c.id } : { kind: 'alpha' }
}

export type RouteResult =
  | { ok: true; lead: LeadRecord; to: { kind: 'alpha' } | { kind: 'company'; id: Id } }
  | { ok: false; reason: 'not-found' | 'not-new' }

export type LeadActionResult =
  | { ok: true; lead: LeadRecord }
  | { ok: false; reason: 'not-found' | 'not-yours' | 'not-offered' | 'too-late' | 'not-accepted' }

/**
 * Leads (docs/tasks/0018, ADR 0018): a storefront enquiry offered to one company at a time for
 * 24 hours, then the next, then Alpha. Every change is a compare-and-set; each offer is recorded
 * as an attempt with its result.
 */
export class LeadService {
  constructor(
    private readonly store: LeadStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(
    input: Omit<
      NewLead,
      'number' | 'status' | 'offeredTo' | 'acceptBy' | 'attempts' | 'outcome' | 'value'
    >,
  ) {
    return this.store.insertLead({
      ...input,
      number: await this.store.nextLeadNumber(input.market, this.now()),
      status: 'new',
      offeredTo: null,
      acceptBy: null,
      attempts: [],
      outcome: null,
      value: null,
    })
  }

  /** Offers a `new` lead to the next company, or hands it to Alpha. Safe to run twice. */
  async route(number: string, candidates: readonly LeadCandidate[]): Promise<RouteResult> {
    const lead = await this.store.findByNumber(number)
    if (!lead) return { ok: false, reason: 'not-found' }
    if (!(await this.store.transition(lead.id, ['new'], 'routing')))
      return { ok: false, reason: 'not-new' }
    const tried = new Set(lead.attempts.map((a) => String(a.company)))
    const to = nextRecipient(lead, candidates, tried)
    if (to.kind === 'alpha') {
      await this.store.transition(lead.id, ['routing'], 'with-alpha', {
        offeredTo: null,
        acceptBy: null,
      })
      return {
        ok: true,
        to,
        lead: { ...lead, status: 'with-alpha', offeredTo: null, acceptBy: null },
      }
    }
    const offeredAt = this.now()
    const acceptBy = new Date(offeredAt.getTime() + ACCEPT_WINDOW_MS)
    const attempts: LeadAttempt[] = [
      ...lead.attempts,
      { company: to.id, offeredAt, acceptBy, result: 'pending' },
    ]
    await this.store.transition(lead.id, ['routing'], 'offered', {
      offeredTo: to.id,
      acceptBy,
      attempts,
    })
    return {
      ok: true,
      to,
      lead: { ...lead, status: 'offered', offeredTo: to.id, acceptBy, attempts },
    }
  }

  private settle(lead: LeadRecord, result: LeadAttempt['result']): LeadAttempt[] {
    return lead.attempts.map((a, i) =>
      i === lead.attempts.length - 1 && a.result === 'pending' ? { ...a, result } : a,
    )
  }

  /** The offered company accepts before the deadline; only then may it see the contact. */
  async accept(number: string, company: Id): Promise<LeadActionResult> {
    const lead = await this.store.findByNumber(number)
    if (!lead) return { ok: false, reason: 'not-found' }
    if (lead.status !== 'offered') return { ok: false, reason: 'not-offered' }
    if (String(lead.offeredTo) !== String(company)) return { ok: false, reason: 'not-yours' }
    if (!lead.acceptBy || lead.acceptBy <= this.now()) return { ok: false, reason: 'too-late' }
    const attempts = this.settle(lead, 'accepted')
    if (!(await this.store.transition(lead.id, ['offered'], 'accepted', { attempts })))
      return { ok: false, reason: 'not-offered' }
    return { ok: true, lead: { ...lead, status: 'accepted', attempts } }
  }

  /** The offered company passes; the lead goes back to `new` for the next company. */
  async decline(number: string, company: Id): Promise<LeadActionResult> {
    const lead = await this.store.findByNumber(number)
    if (!lead) return { ok: false, reason: 'not-found' }
    if (lead.status !== 'offered') return { ok: false, reason: 'not-offered' }
    if (String(lead.offeredTo) !== String(company)) return { ok: false, reason: 'not-yours' }
    const attempts = this.settle(lead, 'declined')
    const patch = { attempts, offeredTo: null, acceptBy: null }
    if (!(await this.store.transition(lead.id, ['offered'], 'new', patch)))
      return { ok: false, reason: 'not-offered' }
    return { ok: true, lead: { ...lead, ...patch, status: 'new' } }
  }

  /** Offers past their deadline go back to `new`; returns the lead numbers to route again. */
  async expireOffers(limit = 100): Promise<string[]> {
    const expired: string[] = []
    for (const lead of await this.store.listExpiredOffers(this.now(), limit)) {
      const patch = { attempts: this.settle(lead, 'expired'), offeredTo: null, acceptBy: null }
      if (await this.store.transition(lead.id, ['offered'], 'new', patch)) expired.push(lead.number)
    }
    return expired
  }

  /** The accepting company records how it ended. */
  async close(
    number: string,
    company: Id,
    outcome: LeadOutcome,
    value: bigint | null = null,
  ): Promise<LeadActionResult> {
    const lead = await this.store.findByNumber(number)
    if (!lead) return { ok: false, reason: 'not-found' }
    if (String(lead.offeredTo) !== String(company)) return { ok: false, reason: 'not-yours' }
    const patch = {
      outcome,
      value: outcome === 'won' && value !== null && value >= 0n ? value : null,
    }
    if (!(await this.store.transition(lead.id, ['accepted'], 'closed', patch)))
      return { ok: false, reason: 'not-accepted' }
    return { ok: true, lead: { ...lead, ...patch, status: 'closed' } }
  }
}
