import { describe, expect, it } from 'vitest'
import { checkInvariants } from './invariants'
import { LedgerService } from './LedgerService'
import { MemoryLedgerStore } from './memoryStore'
import { runScenario } from './scenario'

describe('ledger invariants (memory store)', () => {
  it.each([1, 2, 3])('hold after 1,000 random operations (seed %i)', async (seed) => {
    const store = new MemoryLedgerStore([
      { id: 1, market: 'ae', sellable: true },
      { id: 2, market: 'ae', sellable: true },
      { id: 3, market: 'ae', sellable: false },
    ])
    let clock = Date.parse('2026-10-14T08:00:00Z')
    const ledger = new LedgerService(store, () => new Date((clock += 1_000)))
    const report = await runScenario(ledger, {
      steps: 1_000,
      seed,
      bulkSkus: ['MA352', 'C12000'],
      serialSkus: ['MC462'],
      locations: [1, 2, 3],
      market: 'ae',
    })
    await ledger.releaseExpiredReservations()

    expect(report.applied).toBeGreaterThan(400)
    expect(store.movements.length).toBeGreaterThan(500)
    expect(checkInvariants(store)).toEqual([])
  })

  it('reports each kind of violation', () => {
    const at = new Date()
    const problems = checkInvariants({
      movements: [
        {
          sku: 'A',
          serial: null,
          qty: 2,
          fromState: null,
          toState: 'available',
          location: 1,
          docType: 'receipt',
          docId: 'R',
          user: null,
          reason: null,
          createdAt: at,
        },
        {
          sku: 'B',
          serial: 'S1',
          qty: 1,
          fromState: null,
          toState: 'available',
          location: 1,
          docType: 'receipt',
          docId: 'R',
          user: null,
          reason: null,
          createdAt: at,
        },
        {
          sku: 'B',
          serial: 'S2',
          qty: 1,
          fromState: null,
          toState: 'available',
          location: 1,
          docType: 'receipt',
          docId: 'R',
          user: null,
          reason: null,
          createdAt: at,
        },
      ],
      levels: [
        { sku: 'A', location: 1, state: 'available', qty: 1 },
        { sku: 'A', location: 1, state: 'demo', qty: -1 },
        { sku: 'A', location: 1, state: 'reserved', qty: 1 },
        { sku: 'B', location: 1, state: 'available', qty: 2 },
      ],
      serials: [
        { serial: 'S1', sku: 'B', state: 'demo', location: 1 },
        { serial: 'S3', sku: 'B', state: 'available', location: 1 },
        { serial: 'S3', sku: 'B', state: 'available', location: 1 },
      ],
      reservations: [],
    })
    expect(problems.join('\n')).toMatch(/negative level: A \/ 1 \/ demo = -1/)
    expect(problems.join('\n')).toMatch(/movements sum to 2 but level is 1/)
    expect(problems.join('\n')).toMatch(/serial S3 has 2 records/)
    expect(problems.join('\n')).toMatch(
      /serial S1 is demo at 1, its last movement says available at 1/,
    )
    expect(problems.join('\n')).toMatch(/serial S2 moved but has no record/)
    expect(problems.join('\n')).toMatch(/reserved 1 but active reservations hold 0/)
  })
})
