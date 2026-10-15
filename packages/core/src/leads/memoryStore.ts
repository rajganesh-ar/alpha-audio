import type { Id } from '../ledger/types'
import type { LeadPatch, LeadRecord, LeadStatus, LeadStore, NewLead } from './types'

/** In-memory lead store for unit tests (Postgres: `@alpha/payload` system store). */
export class MemoryLeadStore implements LeadStore {
  readonly leads: Array<LeadRecord & { idempotencyKey: string }> = []
  private sequence = 0

  async nextLeadNumber(market: string, now: Date) {
    return `L-${market.toUpperCase()}-${now.getUTCFullYear()}-${String(++this.sequence).padStart(6, '0')}`
  }

  async findByNumber(number: string) {
    const lead = this.leads.find((l) => l.number === number)
    return lead ? structuredClone(lead) : null
  }

  async insertLead(input: NewLead) {
    const existing = this.leads.find((l) => l.idempotencyKey === input.idempotencyKey)
    if (existing) return { lead: structuredClone(existing), created: false }
    const copy: Partial<NewLead> = { ...input }
    delete copy.details
    const record = {
      ...structuredClone(copy as Omit<NewLead, 'details'>),
      id: this.leads.length + 1,
    }
    this.leads.push(record)
    return { lead: structuredClone(record), created: true }
  }

  async transition(id: Id, from: readonly LeadStatus[], to: LeadStatus, patch: LeadPatch = {}) {
    const lead = this.leads.find((l) => l.id === id)
    if (!lead || !from.includes(lead.status)) return false
    Object.assign(lead, structuredClone(patch), { status: to })
    return true
  }

  async listExpiredOffers(now: Date, limit: number) {
    return this.leads
      .filter((l) => l.status === 'offered' && l.acceptBy !== null && l.acceptBy <= now)
      .slice(0, limit)
      .map((l) => structuredClone(l))
  }
}
