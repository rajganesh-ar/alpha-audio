import { describe, expect, it } from 'vitest'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { LedgerError } from '@alpha/core'
import { checkInvariants } from '@alpha/core/testing'
import { LEDGER_QUEUE, RELEASE_EXPIRED_RESERVATIONS, createLedger } from '@alpha/payload'
import { db, ledgerSnapshot, seedInventory, staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'

const payload = usePayload()

/** Resolves to the error a promise rejects with, or fails the test if it resolves. */
type Refusal = Error & { status?: number | undefined; code?: string | undefined }

async function rejection(action: Promise<unknown>): Promise<Refusal> {
  try {
    await action
  } catch (error) {
    return error as Refusal
  }
  throw new Error('expected the operation to be refused')
}

const LEDGER_COLLECTIONS = [
  'stock-movements',
  'stock-levels',
  'serial-numbers',
  'reservations',
] as const

describe('ledger-owned collections refuse every write from outside the ledger', () => {
  it('has rows to try on', async () => {
    const { main } = await seedInventory(payload())
    const ledger = createLedger(payload())
    await ledger.move({
      sku: 'MC462',
      qty: 1,
      serial: 'SN-ACCESS',
      from: null,
      to: 'available',
      location: main,
      doc: { type: 'receipt', id: 'GR-A' },
    })
    const r = await ledger.reserve({
      sku: 'MC462',
      qty: 1,
      location: main,
      doc: { type: 'quote', id: 'Q-A' },
    })
    expect(r.ok).toBe(true)
  })

  it.each(LEDGER_COLLECTIONS)(
    '%s: staff can read but not create, update or delete (Local API, overrideAccess: false)',
    async (collection) => {
      const user = await staff(payload())
      const { docs } = await payload().find({ collection, user, overrideAccess: false, limit: 1 })
      const row = docs[0]
      expect(row, 'a row exists').toBeDefined()
      if (!row) return

      const update = await rejection(
        payload().update({
          collection,
          id: row.id,
          data: { sku: 'TAMPERED' } as never,
          user,
          overrideAccess: false,
        }),
      )
      expect(update.status).toBe(403)
      const remove = await rejection(
        payload().delete({ collection, id: row.id, user, overrideAccess: false }),
      )
      expect(remove.status).toBe(403)
      const create = await rejection(
        payload().create({
          collection,
          data: { ...row, id: undefined } as never,
          user,
          overrideAccess: false,
        }),
      )
      expect(create.status).toBe(403)

      const again = await payload().findByID({
        collection,
        id: row.id,
        user,
        overrideAccess: false,
      })
      expect(again.sku).toBe(row.sku)
    },
  )

  it.each(LEDGER_COLLECTIONS)('%s: anonymous requests cannot even read', async (collection) => {
    const read = await rejection(payload().find({ collection, overrideAccess: false }))
    expect(read.status).toBe(403)
  })

  it('shows stock levels read-only in the admin (no update permission for staff)', async () => {
    const user = await staff(payload())
    // The admin renders documents from these permissions; update false means read-only fields.
    const { docs } = await payload().find({
      collection: 'stock-levels',
      user,
      overrideAccess: false,
      limit: 1,
    })
    const levels = payload().collections['stock-levels'].config.access
    const req = { user, payload: payload() } as never
    expect(await levels.update({ req, id: docs[0]?.id } as never)).toBe(false)
    expect(await levels.read({ req } as never)).toBe(true)
  })

  it('refuses UPDATE, DELETE and TRUNCATE of stock_movements in the database itself', async () => {
    const count = async () =>
      Number(
        (await db(payload()).execute(sql`SELECT count(*) AS n FROM stock_movements`)).rows[0]?.[
          'n'
        ],
      )
    const before = await count()
    // TRUNCATE … CASCADE gets past the foreign keys that already stop a plain TRUNCATE; the trigger stops it.
    for (const statement of [
      sql`UPDATE stock_movements SET qty = 99`,
      sql`DELETE FROM stock_movements`,
      sql`TRUNCATE stock_movements CASCADE`,
    ]) {
      const error = await rejection(db(payload()).execute(statement))
      expect(`${error.message} ${String(error.cause ?? '')}`).toMatch(
        /stock_movements is insert-only \((UPDATE|DELETE|TRUNCATE) refused\)/,
      )
    }
    expect(await count()).toBe(before)
  })

  it('refuses a negative level or a fractional movement in the database itself', async () => {
    const level = await rejection(db(payload()).execute(sql`UPDATE stock_levels SET qty = -1`))
    expect(`${level.message} ${String(level.cause ?? '')}`).toMatch(
      /stock_levels_qty_whole_non_negative/,
    )
    const { main } = await seedInventory(payload())
    const movement = await rejection(
      db(payload()).execute(
        sql`INSERT INTO stock_movements (sku, qty, to_state, location_id, doc_type, doc_id) VALUES ('X', 1.5, 'available', ${main}, 'receipt', 'R')`,
      ),
    )
    expect(`${movement.message} ${String(movement.cause ?? '')}`).toMatch(
      /stock_movements_qty_whole_positive/,
    )
  })

  it('keeps serial numbers unique in the database', async () => {
    const { rows } = await db(payload()).execute(
      sql`SELECT indexdef FROM pg_indexes WHERE tablename = 'serial_numbers' AND indexdef LIKE '%UNIQUE%(serial)%'`,
    )
    expect(rows).toHaveLength(1)
  })
})

describe('counts', () => {
  it('posts a variance as a count movement and refuses one without a reason', async () => {
    const { main } = await seedInventory(payload())
    const user = await staff(payload())
    const ledger = createLedger(payload())
    await ledger.move({
      sku: 'COUNT-1',
      qty: 10,
      from: null,
      to: 'available',
      location: main,
      doc: { type: 'receipt', id: 'GR-C' },
    })

    const missing = await rejection(
      ledger.adjustFromCount({
        sku: 'COUNT-1',
        location: main,
        counted: 8,
        reason: '',
        countId: 'SC-1',
        user: user.id,
      }),
    )
    expect(missing).toBeInstanceOf(LedgerError)
    expect((missing as LedgerError).code).toBe('reason-required')

    expect(
      await ledger.adjustFromCount({
        sku: 'COUNT-1',
        location: main,
        counted: 8,
        reason: 'Two units damaged in transit, written off',
        countId: 'SC-1',
        user: user.id,
      }),
    ).toEqual({ variance: -2, movements: 1 })
    const { docs } = await payload().find({
      collection: 'stock-movements',
      where: { docType: { equals: 'count' }, sku: { equals: 'COUNT-1' } },
      user,
      overrideAccess: false,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      docId: 'SC-1',
      qty: 2,
      fromState: 'available',
      toState: null,
      reason: 'Two units damaged in transit, written off',
    })
    expect(typeof docs[0]?.user === 'object' ? docs[0]?.user?.id : docs[0]?.user).toBe(user.id)
    expect(await ledger.sellable('COUNT-1', 'ae')).toBe(8)
  })
})

describe('releaseExpiredReservations job', () => {
  it('is scheduled every minute on the ledger queue', () => {
    const task = payload().config.jobs.tasks?.find((t) => t.slug === RELEASE_EXPIRED_RESERVATIONS)
    expect(task?.schedule).toEqual([{ cron: '0 * * * * *', queue: LEDGER_QUEUE }])
  })

  it('returns expired holds to available when the queue runs', async () => {
    const { main } = await seedInventory(payload())
    const past = createLedger(payload(), () => new Date(Date.now() - 16 * 60_000)) // reservations made 16 minutes ago
    await past.move({
      sku: 'EXPIRY-1',
      qty: 4,
      from: null,
      to: 'available',
      location: main,
      doc: { type: 'receipt', id: 'GR-E' },
    })
    const cart = await past.reserve({
      sku: 'EXPIRY-1',
      qty: 2,
      location: main,
      doc: { type: 'cart', id: 'cart-E' },
    })
    const quote = await past.reserve({
      sku: 'EXPIRY-1',
      qty: 1,
      location: main,
      doc: { type: 'quote', id: 'quote-E' },
    })
    expect(cart.ok && quote.ok).toBe(true)
    expect(await createLedger(payload()).sellable('EXPIRY-1', 'ae')).toBe(1)

    await payload().jobs.queue({
      task: RELEASE_EXPIRED_RESERVATIONS,
      queue: LEDGER_QUEUE,
      input: {},
    })
    await payload().jobs.run({ queue: LEDGER_QUEUE })

    const user = await staff(payload())
    const { docs } = await payload().find({
      collection: 'reservations',
      where: { sku: { equals: 'EXPIRY-1' } },
      sort: 'id',
      user,
      overrideAccess: false,
    })
    expect(docs.map((d) => [d.docType, d.status])).toEqual([
      ['cart', 'expired'], // 15 minutes are up
      ['quote', 'active'], // 7 days are not
    ])
    expect(await createLedger(payload()).sellable('EXPIRY-1', 'ae')).toBe(3)
    expect(checkInvariants(await ledgerSnapshot(payload()))).toEqual([])
  })
})
