import { describe, expect, it } from 'vitest'
import { MemoryProjectStore } from './memoryStore'
import { ProjectService, projectPrices, projectState, type RegisterInput } from './ProjectService'

let clock = new Date('2026-10-15T08:00:00Z')
const setup = () => {
  clock = new Date('2026-10-15T08:00:00Z')
  const store = new MemoryProjectStore()
  return { store, service: new ProjectService(store, () => clock) }
}

const input = (overrides: Partial<RegisterInput> = {}): RegisterInput => ({
  company: { id: 7, market: 'ae' },
  registrant: { id: 70, role: 'purchaser' },
  idempotencyKey: `p-${Math.random()}`,
  name: 'Palm villa cinema',
  endCustomer: 'Private client',
  expectedClose: '2026-12-01',
  lines: [
    { sku: 'AMP', productId: 1, title: 'Amplifier', qty: 2 },
    { sku: 'SPK', productId: 2, title: 'Speakers', qty: 6 },
  ],
  details: { city: 'Dubai' },
  ...overrides,
})

describe('ProjectService', () => {
  it('registers a project once per key, unpriced and submitted', async () => {
    const { service, store } = setup()
    const a = await service.register(input({ idempotencyKey: 'same' }))
    const b = await service.register(input({ idempotencyKey: 'same' }))
    expect(a).toMatchObject({
      ok: true,
      created: true,
      project: {
        number: 'P-AE-2026-000001',
        status: 'submitted',
        lines: [{ sku: 'AMP', price: null }, { price: null }],
        idempotencyKey: '7:same',
      },
    })
    expect(b).toMatchObject({ ok: true, created: false })
    expect(store.projects).toHaveLength(1)
  })

  it('refuses viewers and names every problem', async () => {
    const { service } = setup()
    expect(await service.register(input({ registrant: { id: 1, role: 'viewer' } }))).toEqual({
      ok: false,
      reason: 'not-allowed',
    })
    expect(
      await service.register(
        input({
          name: ' ',
          endCustomer: '',
          expectedClose: '2026-01-01',
          lines: [{ sku: 'X', productId: null, title: 'X', qty: 0 }],
        }),
      ),
    ).toEqual({
      ok: false,
      reason: 'invalid',
      problems: ['name', 'end-customer', 'expected-close', 'invalid-quantity', 'unknown-product'],
    })
    expect(await service.register(input({ lines: [], expectedClose: 'soon' }))).toMatchObject({
      problems: ['expected-close', 'no-lines'],
    })
    const many = Array.from({ length: 101 }, (_, i) => ({
      sku: `S${i}`,
      productId: i,
      title: 'x',
      qty: 1,
    }))
    expect(await service.register(input({ lines: many }))).toMatchObject({
      problems: ['too-many-lines'],
    })
  })

  it('approves with prices and a validity; the prices hold until it expires', async () => {
    const { service } = setup()
    const placed = await service.register(input())
    const number = placed.ok ? placed.project.number : ''
    const approved = await service.decide(number, {
      by: 1,
      decision: 'approve',
      prices: { AMP: 650_000n },
      validityDays: 30,
      note: 'Approved for the villa',
    })
    expect(approved).toMatchObject({
      ok: true,
      project: {
        status: 'approved',
        validUntil: new Date('2026-11-14T08:00:00Z'),
        lines: [
          { sku: 'AMP', price: 650_000n },
          { sku: 'SPK', price: null },
        ],
        decisionNote: 'Approved for the villa',
        decidedBy: 1,
      },
    })
    const project = approved.ok ? approved.project : null
    if (!project) throw new Error('not approved')
    expect(projectPrices(project, clock)).toEqual([{ sku: 'AMP', price: 650_000n }])
    const later = new Date('2026-11-14T08:00:00Z')
    expect(projectState(project, later)).toBe('expired')
    expect(projectPrices(project, later)).toEqual([])
    expect(await service.decide(number, { by: 1, decision: 'reject' })).toEqual({
      ok: false,
      reason: 'not-submitted',
    })
  })

  it('needs at least one valid price to approve, and clamps the validity', async () => {
    const { service } = setup()
    const placed = await service.register(input())
    const number = placed.ok ? placed.project.number : ''
    expect(
      await service.decide(number, { by: 1, decision: 'approve', prices: { NOPE: 1n } }),
    ).toEqual({ ok: false, reason: 'no-prices' })
    expect(
      await service.decide(number, { by: 1, decision: 'approve', prices: { AMP: -1n } }),
    ).toEqual({ ok: false, reason: 'invalid-price' })
    const approved = await service.decide(number, {
      by: 1,
      decision: 'approve',
      prices: { AMP: 1n },
      validityDays: 1000,
    })
    expect(approved.ok && approved.project.validUntil).toEqual(new Date('2027-10-15T08:00:00Z'))
    expect(await service.decide('P-NOPE', { by: 1, decision: 'reject' })).toEqual({
      ok: false,
      reason: 'not-found',
    })
  })

  it('rejects with a reason; withdraws submitted or approved projects; one reviewer wins', async () => {
    const { service } = setup()
    const a = await service.register(input())
    const rejected = await service.decide(a.ok ? a.project.number : '', {
      by: 1,
      decision: 'reject',
      note: 'Already registered by another dealer',
    })
    expect(rejected).toMatchObject({
      ok: true,
      project: { status: 'rejected', decisionNote: 'Already registered by another dealer' },
    })
    expect(projectPrices(rejected.ok ? rejected.project : (null as never), clock)).toEqual([])

    const b = await service.register(input())
    const number = b.ok ? b.project.number : ''
    const race = await Promise.all([
      service.decide(number, { by: 1, decision: 'approve', prices: { AMP: 1n } }),
      service.decide(number, { by: 2, decision: 'reject' }),
    ])
    expect(race.filter((r) => r.ok)).toHaveLength(1)
    expect(await service.withdraw(number)).toMatchObject({
      ok: true,
      project: { status: 'withdrawn' },
    })
    expect(await service.withdraw(number)).toEqual({ ok: false, reason: 'not-submitted' })
    expect(await service.withdraw('P-NOPE')).toEqual({ ok: false, reason: 'not-found' })
  })
})
