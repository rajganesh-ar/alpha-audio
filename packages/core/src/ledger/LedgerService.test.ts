import { describe, expect, it } from 'vitest'
import { LedgerError } from './errors'
import { LedgerService } from './LedgerService'
import { MemoryLedgerStore } from './memoryStore'
import { levelId, type StockState } from './types'

const DXB = 1 // Dubai warehouse, sellable
const SHOW = 2 // Dubai showroom, sellable
const DEMO = 3 // demo room, not sellable
const RUH = 4 // Riyadh, sellable in sa

function setup(start = new Date('2026-10-14T08:00:00Z')) {
  let now = start
  const store = new MemoryLedgerStore([
    { id: DXB, market: 'ae', sellable: true },
    { id: SHOW, market: 'ae', sellable: true },
    { id: DEMO, market: 'ae', sellable: false },
    { id: RUH, market: 'sa', sellable: true },
  ])
  const ledger = new LedgerService(store, () => now)
  const level = (sku: string, location: number, state: StockState) =>
    store.levels.find((l) => levelId(l) === levelId({ sku, location, state }))?.qty ?? 0
  const receive = async (sku: string, qty: number, location = DXB) => {
    await ledger.move({
      sku,
      qty,
      from: null,
      to: 'received',
      location,
      doc: { type: 'receipt', id: 'GR-1' },
    })
    await ledger.move({
      sku,
      qty,
      from: 'received',
      to: 'available',
      location,
      doc: { type: 'receipt', id: 'GR-1' },
    })
  }
  const receiveSerial = async (sku: string, serial: string, location = DXB) => {
    await ledger.move({
      sku,
      qty: 1,
      serial,
      from: null,
      to: 'available',
      location,
      doc: { type: 'receipt', id: 'GR-2' },
    })
  }
  return {
    store,
    ledger,
    level,
    receive,
    receiveSerial,
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
  }
}

const code = (e: unknown) => (e instanceof LedgerError ? e.code : String(e))
async function refused(work: Promise<unknown>): Promise<string> {
  try {
    await work
  } catch (e) {
    return code(e)
  }
  return 'accepted'
}

describe('moves', () => {
  it('receives and puts away, deriving levels from movements', async () => {
    const { store, level, receive } = setup()
    await receive('MA352', 5)
    expect(level('MA352', DXB, 'received')).toBe(0)
    expect(level('MA352', DXB, 'available')).toBe(5)
    expect(store.movements.map((m) => [m.fromState, m.toState, m.qty])).toEqual([
      [null, 'received', 5],
      ['received', 'available', 5],
    ])
  })

  it.each([
    ['reserved only through reserve()', { from: 'available', to: 'reserved' }, 'invalid-move'],
    ['picked only through pick()', { from: 'picked', to: 'available' }, 'invalid-move'],
    ['a move must change state', { from: 'available', to: 'available' }, 'invalid-move'],
    [
      'an order cannot create stock',
      { from: null, to: 'available', doc: { type: 'order', id: 'O1' } },
      'invalid-move',
    ],
    ['a receipt cannot destroy stock', { from: 'available', to: null }, 'invalid-move'],
    [
      'an adjustment needs a reason',
      { from: 'available', to: 'damaged', doc: { type: 'adjustment', id: 'A1' } },
      'reason-required',
    ],
    ['quantities are whole', { qty: 1.5 }, 'invalid-quantity'],
    ['quantities are positive', { qty: 0 }, 'invalid-quantity'],
    ['a SKU is required', { sku: ' ' }, 'invalid-move'],
    ['a document id is required', { doc: { type: 'receipt', id: '' } }, 'invalid-move'],
    ['cannot move more than there is', { qty: 6 }, 'insufficient-stock'],
  ] as const)('refuses: %s', async (_name, patch, expected) => {
    const { ledger, receive } = setup()
    await receive('MA352', 5)
    const input = {
      sku: 'MA352',
      qty: 1,
      from: 'available',
      to: 'demo',
      location: DXB,
      doc: { type: 'receipt', id: 'GR-1' },
      ...patch,
    } as Parameters<typeof ledger.move>[0]
    expect(await refused(ledger.move(input))).toBe(expected)
  })

  it('writes nothing when an operation is refused', async () => {
    const { store, ledger, receive } = setup()
    await receive('MA352', 2)
    const before = { movements: store.movements.length, levels: JSON.stringify(store.levels) }
    await refused(
      ledger.transfer({
        sku: 'MA352',
        qty: 3,
        from: { location: DXB, state: 'available' },
        to: { location: SHOW, state: 'available' },
        doc: { type: 'transfer', id: 'T1' },
      }),
    )
    expect(store.movements.length).toBe(before.movements)
    expect(JSON.stringify(store.levels)).toBe(before.levels)
  })

  it('allows a reasoned adjustment, e.g. write-off of damaged stock', async () => {
    const { ledger, level, receive } = setup()
    await receive('MA352', 2)
    await ledger.move({
      sku: 'MA352',
      qty: 1,
      from: 'available',
      to: null,
      location: DXB,
      doc: { type: 'adjustment', id: 'W1' },
      reason: '  Dropped in the warehouse ',
    })
    expect(level('MA352', DXB, 'available')).toBe(1)
  })
})

describe('transfers', () => {
  it('moves stock between locations in one operation', async () => {
    const { ledger, level, receive } = setup()
    await receive('C12000', 4)
    await ledger.transfer({
      sku: 'C12000',
      qty: 3,
      from: { location: DXB, state: 'available' },
      to: { location: SHOW, state: 'ex_display' },
      doc: { type: 'transfer', id: 'T1' },
    })
    expect([level('C12000', DXB, 'available'), level('C12000', SHOW, 'ex_display')]).toEqual([1, 3])
  })

  it('moves a serial between locations', async () => {
    const { store, ledger, receiveSerial } = setup()
    await receiveSerial('MC462', 'SN-1')
    await ledger.transfer({
      sku: 'MC462',
      qty: 1,
      serial: 'SN-1',
      from: { location: DXB, state: 'available' },
      to: { location: DEMO, state: 'demo' },
      doc: { type: 'transfer', id: 'T2' },
    })
    expect(store.serials).toEqual([{ serial: 'SN-1', sku: 'MC462', state: 'demo', location: DEMO }])
  })

  it.each([
    ['the same location', { to: { location: DXB, state: 'demo' } }],
    ['reserved stock', { from: { location: DXB, state: 'reserved' } }],
  ] as const)('refuses a transfer within %s', async (_n, patch) => {
    const { ledger, receive } = setup()
    await receive('C12000', 1)
    const input = {
      sku: 'C12000',
      qty: 1,
      from: { location: DXB, state: 'available' },
      to: { location: SHOW, state: 'available' },
      doc: { type: 'transfer', id: 'T' },
      ...patch,
    } as Parameters<typeof ledger.transfer>[0]
    expect(await refused(ledger.transfer(input))).toBe('invalid-move')
  })
})

describe('reservations', () => {
  it('reserves, picks, ships and delivers', async () => {
    const { store, ledger, level, receive } = setup()
    await receive('MA352', 3)
    const r = await ledger.reserve({
      sku: 'MA352',
      qty: 2,
      market: 'ae',
      doc: { type: 'order', id: 'AE-1001' },
    })
    if (!r.ok) throw new Error('expected a reservation')
    expect(r.reservation).toMatchObject({
      location: DXB,
      qty: 2,
      status: 'active',
      expiresAt: null,
    })
    expect([level('MA352', DXB, 'available'), level('MA352', DXB, 'reserved')]).toEqual([1, 2])

    await ledger.pick(r.reservation.id)
    await ledger.ship({
      sku: 'MA352',
      qty: 2,
      location: DXB,
      doc: { type: 'shipment', id: 'SH-1' },
    })
    await ledger.deliver({
      sku: 'MA352',
      qty: 2,
      location: DXB,
      doc: { type: 'shipment', id: 'SH-1' },
    })
    expect([
      level('MA352', DXB, 'reserved'),
      level('MA352', DXB, 'picked'),
      level('MA352', DXB, 'delivered'),
    ]).toEqual([0, 0, 2])
    expect(store.reservations[0]?.status).toBe('picked')
    expect(
      await refused(
        ledger.ship({ sku: 'MA352', qty: 1, location: DXB, doc: { type: 'shipment', id: 'SH-2' } }),
      ),
    ).toBe('insufficient-stock')
  })

  it('reserves at one location, the first in the market that has enough', async () => {
    const { ledger, receive } = setup()
    await receive('MA352', 1, DXB)
    await receive('MA352', 3, SHOW)
    await receive('MA352', 9, DEMO) // not sellable
    const r = await ledger.reserve({
      sku: 'MA352',
      qty: 2,
      market: 'ae',
      doc: { type: 'cart', id: 'C1' },
    })
    expect(r.ok && r.reservation.location).toBe(SHOW)
    expect(
      await ledger.reserve({ sku: 'MA352', qty: 5, market: 'ae', doc: { type: 'cart', id: 'C2' } }),
    ).toEqual({ ok: false, reason: 'insufficient-stock', available: 2 })
  })

  it('reports nothing to reserve in a market without fulfilment locations', async () => {
    const { ledger } = setup()
    expect(
      await ledger.reserve({ sku: 'X', qty: 1, market: 'om', doc: { type: 'cart', id: 'C' } }),
    ).toEqual({ ok: false, reason: 'insufficient-stock', available: 0 })
    expect(
      await ledger.reserve({ sku: 'X', qty: 1, doc: { type: 'cart', id: 'C' } }),
    ).toMatchObject({ ok: false })
  })

  it.each([
    ['cart', 15 * 60_000],
    ['pos', 30 * 60_000],
    ['quote', 7 * 24 * 3_600_000],
  ] as const)('holds a %s for the spec time', async (type, ms) => {
    const { ledger, receive } = setup()
    await receive('MA352', 1)
    const r = await ledger.reserve({ sku: 'MA352', qty: 1, location: DXB, doc: { type, id: 'D1' } })
    expect(r.ok && r.reservation.expiresAt?.getTime()).toBe(
      new Date('2026-10-14T08:00:00Z').getTime() + ms,
    )
  })

  it('needs an explicit expiry for project allocations', async () => {
    const { ledger, receive } = setup()
    await receive('MA352', 1)
    expect(
      await refused(
        ledger.reserve({ sku: 'MA352', qty: 1, location: DXB, doc: { type: 'project', id: 'P1' } }),
      ),
    ).toBe('expiry-required')
    const until = new Date('2027-01-31T00:00:00Z')
    const r = await ledger.reserve({
      sku: 'MA352',
      qty: 1,
      location: DXB,
      doc: { type: 'project', id: 'P1' },
      expiresAt: until,
    })
    expect(r.ok && r.reservation.expiresAt).toEqual(until)
  })

  it('releases once; a second release or an unknown id is refused', async () => {
    const { ledger, level, receive } = setup()
    await receive('MA352', 1)
    const r = await ledger.reserve({
      sku: 'MA352',
      qty: 1,
      location: DXB,
      doc: { type: 'cart', id: 'C1' },
    })
    if (!r.ok) throw new Error('expected a reservation')
    await ledger.release(r.reservation.id, { reason: 'Customer emptied the bag' })
    expect(level('MA352', DXB, 'available')).toBe(1)
    expect(await refused(ledger.release(r.reservation.id))).toBe('reservation-not-active')
    expect(await refused(ledger.pick(999))).toBe('reservation-not-found')
    expect(
      await refused(
        ledger.reserve({ sku: 'MA352', qty: -1, location: DXB, doc: { type: 'cart', id: 'C' } }),
      ),
    ).toBe('invalid-quantity')
  })

  it('expires holds past their time, in batches', async () => {
    const { store, ledger, level, receive, advance } = setup()
    await receive('MA352', 5)
    for (const id of ['C1', 'C2', 'C3'])
      await ledger.reserve({ sku: 'MA352', qty: 1, location: DXB, doc: { type: 'cart', id } })
    await ledger.reserve({ sku: 'MA352', qty: 1, location: DXB, doc: { type: 'quote', id: 'Q1' } })
    advance(14 * 60_000)
    expect(await ledger.releaseExpiredReservations(2)).toBe(0)
    advance(2 * 60_000)
    expect(await ledger.releaseExpiredReservations(2)).toBe(3)
    expect(store.reservations.map((r) => r.status)).toEqual([
      'expired',
      'expired',
      'expired',
      'active',
    ])
    expect([level('MA352', DXB, 'available'), level('MA352', DXB, 'reserved')]).toEqual([4, 1])
  })
})

describe('serials', () => {
  it('moves serialised SKUs one serial per movement and reserves specific units', async () => {
    const { store, ledger, level, receiveSerial } = setup()
    for (const sn of ['SN-2', 'SN-1', 'SN-3']) await receiveSerial('MC462', sn)
    const r = await ledger.reserve({
      sku: 'MC462',
      qty: 2,
      location: DXB,
      doc: { type: 'order', id: 'O1' },
    })
    expect(r.ok && r.reservation.serials).toEqual(['SN-1', 'SN-2'])
    if (!r.ok) return
    await ledger.pick(r.reservation.id)
    expect(level('MC462', DXB, 'picked')).toBe(2)
    expect(store.serials.find((s) => s.serial === 'SN-1')?.state).toBe('picked')
    expect(
      store.movements.filter((m) => m.docId === 'O1').every((m) => m.qty === 1 && m.serial),
    ).toBe(true)
  })

  it.each([
    [
      'a serial already in the ledger',
      (l: LedgerService) =>
        l.move({
          sku: 'MC462',
          qty: 1,
          serial: 'SN-1',
          from: null,
          to: 'available',
          location: SHOW,
          doc: { type: 'receipt', id: 'R' },
        }),
      'serial-duplicate',
    ],
    [
      'a bulk move of a serialised SKU',
      (l: LedgerService) =>
        l.move({
          sku: 'MC462',
          qty: 1,
          from: 'available',
          to: 'demo',
          location: DXB,
          doc: { type: 'receipt', id: 'R' },
        }),
      'serial-required',
    ],
    [
      'a serial on a bulk SKU',
      (l: LedgerService) =>
        l.move({
          sku: 'MA352',
          qty: 1,
          serial: 'X1',
          from: 'available',
          to: 'demo',
          location: DXB,
          doc: { type: 'receipt', id: 'R' },
        }),
      'serial-not-allowed',
    ],
    [
      'more than one unit per serial',
      (l: LedgerService) =>
        l.move({
          sku: 'MC462',
          qty: 2,
          serial: 'SN-1',
          from: 'available',
          to: 'demo',
          location: DXB,
          doc: { type: 'receipt', id: 'R' },
        }),
      'invalid-quantity',
    ],
    [
      'a serial that is somewhere else',
      (l: LedgerService) =>
        l.move({
          sku: 'MC462',
          qty: 1,
          serial: 'SN-1',
          from: 'available',
          to: 'demo',
          location: SHOW,
          doc: { type: 'receipt', id: 'R' },
        }),
      'serial-state',
    ],
    [
      'an unknown serial',
      (l: LedgerService) =>
        l.move({
          sku: 'MC462',
          qty: 1,
          serial: 'NOPE',
          from: 'available',
          to: 'demo',
          location: DXB,
          doc: { type: 'receipt', id: 'R' },
        }),
      'serial-state',
    ],
  ] as const)('refuses %s', async (_n, run, expected) => {
    const { ledger, receive, receiveSerial } = setup()
    await receiveSerial('MC462', 'SN-1')
    await receive('MA352', 1)
    expect(await refused(run(ledger))).toBe(expected)
  })

  it('lets a written-off serial come back, but only under its own SKU', async () => {
    const { ledger, receiveSerial } = setup()
    await receiveSerial('MC462', 'SN-9')
    await ledger.move({
      sku: 'MC462',
      qty: 1,
      serial: 'SN-9',
      from: 'available',
      to: null,
      location: DXB,
      doc: { type: 'adjustment', id: 'W' },
      reason: 'Missing after audit',
    })
    expect(
      await refused(
        ledger.move({
          sku: 'OTHER',
          qty: 1,
          serial: 'SN-9',
          from: null,
          to: 'available',
          location: DXB,
          doc: { type: 'receipt', id: 'R' },
        }),
      ),
    ).toBe('serial-duplicate')
    expect(
      await refused(
        ledger.move({
          sku: 'MC462',
          qty: 1,
          serial: 'SN-9',
          from: null,
          to: 'available',
          location: DXB,
          doc: { type: 'rma', id: 'R' },
        }),
      ),
    ).toBe('accepted')
  })

  it('accepts a new serial of a serialised SKU', async () => {
    const { ledger, receiveSerial } = setup()
    await receiveSerial('MC462', 'SN-1')
    expect(
      await refused(
        ledger.move({
          sku: 'MC462',
          qty: 1,
          serial: 'SN-2',
          from: null,
          to: 'available',
          location: DXB,
          doc: { type: 'receipt', id: 'R' },
        }),
      ),
    ).toBe('accepted')
  })
})

describe('counts', () => {
  it('posts a variance as a count movement with its reason', async () => {
    const { store, ledger, level, receive } = setup()
    await receive('MA352', 5)
    expect(
      await ledger.adjustFromCount({
        sku: 'MA352',
        location: DXB,
        counted: 3,
        reason: 'Two units unaccounted for',
        countId: 'SC-1',
      }),
    ).toEqual({ variance: -2, movements: 1 })
    expect(
      await ledger.adjustFromCount({
        sku: 'MA352',
        location: DXB,
        counted: 4,
        reason: 'Found behind the rack',
        countId: 'SC-2',
      }),
    ).toEqual({ variance: 1, movements: 1 })
    expect(
      await ledger.adjustFromCount({
        sku: 'MA352',
        location: DXB,
        counted: 4,
        reason: 'Recount',
        countId: 'SC-3',
      }),
    ).toEqual({ variance: 0, movements: 0 })
    expect(level('MA352', DXB, 'available')).toBe(4)
    const counts = store.movements.filter((m) => m.docType === 'count')
    expect(counts.map((m) => [m.fromState, m.toState, m.qty, m.reason])).toEqual([
      ['available', null, 2, 'Two units unaccounted for'],
      [null, 'available', 1, 'Found behind the rack'],
    ])
  })

  it.each([
    ['without a reason', { reason: '  ' }, 'reason-required'],
    ['of reserved stock', { state: 'reserved' }, 'invalid-move'],
    ['with a negative count', { counted: -1 }, 'invalid-quantity'],
  ] as const)('refuses a count %s', async (_n, patch, expected) => {
    const { ledger, receive } = setup()
    await receive('MA352', 1)
    const input = {
      sku: 'MA352',
      location: DXB,
      counted: 0,
      reason: 'Count',
      countId: 'SC',
      ...patch,
    } as Parameters<typeof ledger.adjustFromCount>[0]
    expect(await refused(ledger.adjustFromCount(input))).toBe(expected)
  })

  it('reconciles serials: missing ones leave, unknown ones arrive, misplaced ones move', async () => {
    const { store, ledger, level, receiveSerial } = setup()
    for (const sn of ['SN-1', 'SN-2']) await receiveSerial('MC462', sn, DXB)
    await receiveSerial('MC462', 'SN-3', SHOW)
    const result = await ledger.adjustFromCount({
      sku: 'MC462',
      location: DXB,
      countedSerials: ['SN-1', 'SN-3', 'SN-4'],
      reason: 'Annual count',
      countId: 'SC-9',
    })
    expect(result).toEqual({ variance: 1, movements: 4 })
    expect(Object.fromEntries(store.serials.map((s) => [s.serial, [s.state, s.location]]))).toEqual(
      {
        'SN-1': ['available', DXB],
        'SN-2': [null, null],
        'SN-3': ['available', DXB],
        'SN-4': ['available', DXB],
      },
    )
    expect([level('MC462', DXB, 'available'), level('MC462', SHOW, 'available')]).toEqual([3, 0])
  })
})

describe('sellable', () => {
  it('sums available across the market fulfilment locations only', async () => {
    const { ledger, receive } = setup()
    await receive('MA352', 2, DXB)
    await receive('MA352', 1, SHOW)
    await receive('MA352', 7, DEMO)
    await receive('MA352', 4, RUH)
    await ledger.reserve({ sku: 'MA352', qty: 1, location: DXB, doc: { type: 'cart', id: 'C1' } })
    expect(await ledger.sellable('MA352', 'ae')).toBe(2)
    expect(await ledger.sellable('MA352', 'sa')).toBe(4)
    expect(await ledger.sellable('MA352', 'om')).toBe(0)
  })
})

describe('confirm', () => {
  it('turns a cart hold into an order hold without moving stock', async () => {
    const { ledger, store, receive, level, advance } = setup()
    await receive('MA352', 3)
    const r = await ledger.reserve({
      sku: 'MA352',
      qty: 2,
      market: 'ae',
      doc: { type: 'cart', id: 'AE-2026-000001' },
    })
    if (!r.ok) throw new Error('reserve failed')
    const movements = store.movements.length
    const confirmed = await ledger.confirm(r.reservation.id, {
      doc: { type: 'order', id: 'AE-2026-000001' },
    })
    expect(confirmed).toMatchObject({
      docType: 'order',
      docId: 'AE-2026-000001',
      expiresAt: null,
      status: 'active',
    })
    expect(store.movements.length).toBe(movements)
    expect(level('MA352', DXB, 'reserved')).toBe(2)
    advance(60 * 60 * 1000)
    expect(await ledger.releaseExpiredReservations()).toBe(0)
    expect(level('MA352', DXB, 'reserved')).toBe(2)
  })

  it('refuses an expired or inactive hold', async () => {
    const { ledger, receive, advance } = setup()
    await receive('MA352', 2)
    const r = await ledger.reserve({
      sku: 'MA352',
      qty: 1,
      market: 'ae',
      doc: { type: 'cart', id: 'C1' },
    })
    if (!r.ok) throw new Error('reserve failed')
    advance(16 * 60 * 1000)
    await expect(
      ledger.confirm(r.reservation.id, { doc: { type: 'order', id: 'O1' } }),
    ).rejects.toMatchObject({ code: 'reservation-expired' })
    const s = await ledger.reserve({
      sku: 'MA352',
      qty: 1,
      market: 'ae',
      doc: { type: 'cart', id: 'C2' },
    })
    if (!s.ok) throw new Error('reserve failed')
    await ledger.release(s.reservation.id)
    await expect(
      ledger.confirm(s.reservation.id, { doc: { type: 'order', id: 'O2' } }),
    ).rejects.toBeInstanceOf(LedgerError)
  })
})

describe('fulfilment by reservation', () => {
  const ship = { doc: { type: 'shipment' as const, id: 'SH-2026-000001' } }

  async function pickedOrder(serial = false) {
    const t = setup()
    if (serial) {
      await t.receiveSerial('MC462', 'SN-1')
      await t.receiveSerial('MC462', 'SN-2')
    } else await t.receive('MA352', 3)
    const r = await t.ledger.reserve({
      sku: serial ? 'MC462' : 'MA352',
      qty: 2,
      market: 'ae',
      doc: { type: 'order', id: 'AE-2026-000009' },
    })
    if (!r.ok) throw new Error('reserve failed')
    await t.ledger.pick(r.reservation.id)
    return { ...t, id: r.reservation.id }
  }

  it('ships and delivers exactly the reserved units, against the shipment', async () => {
    const { ledger, level, store, id } = await pickedOrder()
    await ledger.shipReservation(id, ship)
    expect(level('MA352', DXB, 'picked')).toBe(0)
    expect(level('MA352', DXB, 'shipped')).toBe(2)
    expect(store.movements.at(-1)).toMatchObject({
      fromState: 'picked',
      toState: 'shipped',
      docType: 'shipment',
      docId: 'SH-2026-000001',
    })
    expect((await ledger.reservation(id))?.status).toBe('shipped')
    await ledger.deliverReservation(id, ship)
    expect(level('MA352', DXB, 'delivered')).toBe(2)
    expect(level('MA352', DXB, 'available')).toBe(1)
    expect((await ledger.reservation(id))?.status).toBe('delivered')
  })

  it('moves serials one by one', async () => {
    const { ledger, store, id } = await pickedOrder(true)
    await ledger.shipReservation(id, ship)
    expect(store.serials.map((s) => [s.serial, s.state])).toEqual([
      ['SN-1', 'shipped'],
      ['SN-2', 'shipped'],
    ])
    await ledger.deliverReservation(id, ship)
    expect(store.serials.every((s) => s.state === 'delivered')).toBe(true)
  })

  it('refuses to ship twice, to deliver before shipping, or to ship a hold not yet picked', async () => {
    const { ledger, level, receive, id } = await pickedOrder()
    await expect(ledger.deliverReservation(id, ship)).rejects.toMatchObject({
      code: 'reservation-wrong-status',
    })
    await ledger.shipReservation(id, ship)
    await expect(ledger.shipReservation(id, ship)).rejects.toMatchObject({
      code: 'reservation-wrong-status',
    })
    expect(level('MA352', DXB, 'shipped')).toBe(2)
    await receive('MA352', 1)
    const held = await ledger.reserve({
      sku: 'MA352',
      qty: 1,
      market: 'ae',
      doc: { type: 'order', id: 'O2' },
    })
    if (!held.ok) throw new Error('reserve failed')
    await expect(ledger.shipReservation(held.reservation.id, ship)).rejects.toMatchObject({
      code: 'reservation-wrong-status',
    })
    await expect(ledger.shipReservation(999, ship)).rejects.toMatchObject({
      code: 'reservation-not-found',
    })
    expect(await ledger.reservation(999)).toBeNull()
  })

  it('returns a picked hold to the shelf', async () => {
    const { ledger, level, id } = await pickedOrder()
    await ledger.returnToStock(id, { reason: 'cancelled' })
    expect(level('MA352', DXB, 'picked')).toBe(0)
    expect(level('MA352', DXB, 'available')).toBe(3)
    expect((await ledger.reservation(id))?.status).toBe('released')
    await expect(ledger.returnToStock(id)).rejects.toMatchObject({
      code: 'reservation-wrong-status',
    })
  })
})
