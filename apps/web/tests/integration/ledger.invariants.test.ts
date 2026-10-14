import { describe, expect, it } from 'vitest'
import { checkInvariants, runScenario } from '@alpha/core/testing'
import { createLedger } from '@alpha/payload'
import { ledgerSnapshot, seedInventory } from './helpers/ledger'
import { usePayload } from './helpers/suite'

/**
 * Mandatory (CLAUDE.md): after a randomised sequence of 1,000 operations against Postgres,
 *  - no level is below zero;
 *  - movements sum to levels for every (sku, location, state);
 *  - every serial has exactly one current state;
 *  - reserved stock equals what active reservations hold.
 */
const payload = usePayload()

describe('ledger invariants (Postgres)', () => {
  it('hold after 1,000 random movements', { timeout: 240_000 }, async () => {
    const { main, showroom, demo } = await seedInventory(payload())
    let clock = Date.parse('2026-10-14T08:00:00Z')
    const ledger = createLedger(payload(), () => new Date((clock += 1_000)))

    const report = await runScenario(ledger, {
      steps: 1_000,
      seed: 20261014,
      bulkSkus: ['MA352', 'C12000'],
      serialSkus: ['MC462'],
      locations: [main, showroom, demo],
      market: 'ae',
    })
    await ledger.releaseExpiredReservations()

    const snapshot = await ledgerSnapshot(payload())
    expect(report.applied).toBeGreaterThan(600)
    expect(snapshot.movements.length).toBeGreaterThan(600)
    expect(snapshot.serials.length).toBeGreaterThan(50)
    expect(checkInvariants(snapshot)).toEqual([])
    expect(Math.min(...snapshot.levels.map((l) => l.qty))).toBeGreaterThanOrEqual(0)
  })
})
