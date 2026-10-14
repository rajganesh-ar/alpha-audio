import { describe, expect, it } from 'vitest'
import { LedgerError } from '@alpha/core'
import { checkInvariants } from '@alpha/core/testing'
import { createLedger } from '@alpha/payload'
import { ledgerSnapshot, seedInventory } from './helpers/ledger'
import { usePayload } from './helpers/suite'

/**
 * Mandatory (CLAUDE.md): 200 parallel reservations on one SKU with 5 units available end with
 * exactly 5 reservations and zero negative stock. Ten rounds, each on a fresh SKU, so one run
 * of this file is ten passes in a row.
 */
const payload = usePayload()
const ROUNDS = 10
const PARALLEL = 200
const STOCK = 5

describe('reservation concurrency', () => {
  it(
    `${PARALLEL} parallel reservations on ${STOCK} units, ${ROUNDS} rounds`,
    { timeout: 300_000 },
    async () => {
      const { main } = await seedInventory(payload())
      const ledger = createLedger(payload())

      for (let round = 1; round <= ROUNDS; round++) {
        const sku = `RACE-${round}`
        await ledger.move({
          sku,
          qty: STOCK,
          from: null,
          to: 'available',
          location: main,
          doc: { type: 'receipt', id: `GR-${round}` },
        })

        const results = await Promise.allSettled(
          Array.from({ length: PARALLEL }, (_, i) =>
            ledger.reserve({
              sku,
              qty: 1,
              market: 'ae',
              doc: { type: 'cart', id: `cart-${round}-${i}` },
            }),
          ),
        )

        const crashed = results.filter((r) => r.status === 'rejected')
        expect(
          crashed.map((r) => String((r as PromiseRejectedResult).reason)),
          `round ${round}: no operation may fail`,
        ).toEqual([])
        const outcomes = results.map(
          (r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof ledger.reserve>>>).value,
        )
        expect(outcomes.filter((o) => o.ok).length, `round ${round}: reservations`).toBe(STOCK)
        expect(outcomes.filter((o) => !o.ok).length, `round ${round}: refusals`).toBe(
          PARALLEL - STOCK,
        )
        expect(await ledger.sellable(sku, 'ae'), `round ${round}: sellable afterwards`).toBe(0)
      }

      const snapshot = await ledgerSnapshot(payload())
      expect(Math.min(...snapshot.levels.map((l) => l.qty))).toBe(0)
      expect(snapshot.reservations.filter((r) => r.status === 'active')).toHaveLength(
        ROUNDS * STOCK,
      )
      expect(checkInvariants(snapshot)).toEqual([])
    },
  )

  it('refuses a duplicate serial booked by two receipts at once', async () => {
    const { main, showroom } = await seedInventory(payload())
    const ledger = createLedger(payload())
    const receive = (location: number) =>
      ledger.move({
        sku: 'MC462',
        qty: 1,
        serial: 'SN-RACE-1',
        from: null,
        to: 'available',
        location,
        doc: { type: 'receipt', id: `GR-${location}` },
      })
    const results = await Promise.allSettled([receive(main), receive(showroom)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const refused = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(refused?.reason).toBeInstanceOf(LedgerError)
    expect((refused?.reason as LedgerError).code).toBe('serial-duplicate')
  })
})
