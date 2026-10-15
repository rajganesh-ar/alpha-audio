import { describe, expect, it } from 'vitest'
import { MemoryLeadStore } from './memoryStore'
import { LeadService, nextRecipient } from './LeadService'
import { leadLimit } from './types'
import type { LeadCandidate } from './types'

let clock = new Date('2026-10-15T08:00:00Z')
const setup = () => {
  clock = new Date('2026-10-15T08:00:00Z')
  const store = new MemoryLeadStore()
  return { store, leads: new LeadService(store, () => clock) }
}
const candidates: LeadCandidate[] = [
  { id: 1, territories: ['Abu Dhabi'], openLeads: 0 },
  { id: 2, territories: ['Dubai', 'Sharjah'], openLeads: 3 },
  { id: 3, territories: [], openLeads: 1 },
]
const lead = (routing: 'alpha' | 'dealer' = 'dealer', city: string | null = 'dubai') => ({
  market: 'ae',
  routing,
  city,
  idempotencyKey: `k-${Math.random()}`,
  details: { contact: { email: 'a@example.com' } },
})

describe('nextRecipient', () => {
  it('prefers the territory, then the fewest open leads, then the lowest id; Alpha when none', () => {
    expect(nextRecipient({ routing: 'dealer', city: ' DUBAI ' }, candidates, new Set())).toEqual({
      kind: 'company',
      id: 2,
    })
    expect(nextRecipient({ routing: 'dealer', city: 'Ajman' }, candidates, new Set())).toEqual({
      kind: 'company',
      id: 1,
    })
    expect(nextRecipient({ routing: 'dealer', city: null }, candidates, new Set(['1']))).toEqual({
      kind: 'company',
      id: 3,
    })
    expect(
      nextRecipient(
        { routing: 'dealer', city: null },
        [
          { id: 10, territories: [], openLeads: 0 },
          { id: 9, territories: [], openLeads: 0 },
        ],
        new Set(),
      ),
    ).toEqual({ kind: 'company', id: 9 })
    expect(
      nextRecipient({ routing: 'dealer', city: 'Dubai' }, candidates, new Set(['1', '2', '3'])),
    ).toEqual({ kind: 'alpha' })
    expect(nextRecipient({ routing: 'alpha', city: 'Dubai' }, candidates, new Set())).toEqual({
      kind: 'alpha',
    })
  })
})

describe('LeadService', () => {
  it('creates once per key and offers to the best company for 24 hours', async () => {
    const { leads, store } = setup()
    const input = lead()
    const a = await leads.create(input)
    const b = await leads.create(input)
    expect(a.created).toBe(true)
    expect(b.created).toBe(false)
    expect(store.leads).toHaveLength(1)
    expect(a.lead).toMatchObject({ number: 'L-AE-2026-000001', status: 'new' })
    const routed = await leads.route(a.lead.number, candidates)
    expect(routed).toMatchObject({
      ok: true,
      to: { kind: 'company', id: 2 },
      lead: {
        status: 'offered',
        offeredTo: 2,
        acceptBy: new Date('2026-10-16T08:00:00Z'),
        attempts: [{ company: 2, result: 'pending' }],
      },
    })
    expect(await leads.route(a.lead.number, candidates)).toEqual({ ok: false, reason: 'not-new' })
    expect(await leads.route('L-NOPE', candidates)).toEqual({ ok: false, reason: 'not-found' })
  })

  it('keeps an Alpha-routed lead with Alpha', async () => {
    const { leads } = setup()
    const { lead: created } = await leads.create(lead('alpha'))
    expect(await leads.route(created.number, candidates)).toMatchObject({
      ok: true,
      to: { kind: 'alpha' },
      lead: { status: 'with-alpha' },
    })
  })

  it('accepts only for the offered company before the deadline, then closes with an outcome', async () => {
    const { leads } = setup()
    const { lead: created } = await leads.create(lead())
    await leads.route(created.number, candidates)
    expect(await leads.accept(created.number, 1)).toEqual({ ok: false, reason: 'not-yours' })
    expect(await leads.close(created.number, 2, 'won')).toEqual({
      ok: false,
      reason: 'not-accepted',
    })
    const accepted = await leads.accept(created.number, 2)
    expect(accepted).toMatchObject({
      ok: true,
      lead: { status: 'accepted', attempts: [{ result: 'accepted' }] },
    })
    expect(await leads.accept(created.number, 2)).toEqual({ ok: false, reason: 'not-offered' })
    expect(await leads.close(created.number, 1, 'lost')).toEqual({ ok: false, reason: 'not-yours' })
    expect(await leads.close(created.number, 2, 'won', 1_250_000n)).toMatchObject({
      ok: true,
      lead: { status: 'closed', outcome: 'won', value: 1_250_000n },
    })
    expect(await leads.accept('L-NOPE', 2)).toEqual({ ok: false, reason: 'not-found' })
    expect(await leads.close('L-NOPE', 2, 'lost')).toEqual({ ok: false, reason: 'not-found' })
  })

  it('re-routes on decline and on expiry, recording every hop, and ends with Alpha', async () => {
    const { leads } = setup()
    const { lead: created } = await leads.create(lead('dealer', 'Dubai'))
    await leads.route(created.number, candidates)
    expect(await leads.decline(created.number, 1)).toEqual({ ok: false, reason: 'not-yours' })
    expect(await leads.decline(created.number, 2)).toMatchObject({
      ok: true,
      lead: { status: 'new' },
    })
    expect(await leads.decline(created.number, 2)).toEqual({ ok: false, reason: 'not-offered' })
    expect(await leads.route(created.number, candidates)).toMatchObject({ to: { id: 1 } })

    clock = new Date('2026-10-16T08:00:00Z')
    expect(await leads.accept(created.number, 1)).toEqual({ ok: false, reason: 'too-late' })
    expect(await leads.expireOffers()).toEqual([created.number])
    expect(await leads.expireOffers()).toEqual([])
    expect(await leads.route(created.number, candidates)).toMatchObject({ to: { id: 3 } })
    clock = new Date('2026-10-17T09:00:00Z')
    await leads.expireOffers()
    const last = await leads.route(created.number, candidates)
    expect(last).toMatchObject({
      ok: true,
      to: { kind: 'alpha' },
      lead: {
        status: 'with-alpha',
        attempts: [
          { company: 2, result: 'declined' },
          { company: 1, result: 'expired' },
          { company: 3, result: 'expired' },
        ],
      },
    })
    expect(await leads.decline('L-NOPE', 2)).toEqual({ ok: false, reason: 'not-found' })
  })

  it('lets only one of two racing routers offer the lead', async () => {
    const { leads } = setup()
    const { lead: created } = await leads.create(lead())
    const results = await Promise.all([
      leads.route(created.number, candidates),
      leads.route(created.number, candidates),
    ])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
  })
})

describe('leadLimit', () => {
  it('limits floods per address and per IP', () => {
    expect(leadLimit({ forEmail: 4, forIp: 19 })).toBe('ok')
    expect(leadLimit({ forEmail: 5, forIp: 0 })).toBe('limited')
    expect(leadLimit({ forEmail: 0, forIp: 20 })).toBe('limited')
  })
})
