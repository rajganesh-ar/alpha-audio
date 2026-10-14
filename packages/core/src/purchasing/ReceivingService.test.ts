import { describe, expect, it } from 'vitest'
import { LedgerService } from '../ledger/LedgerService'
import { MemoryLedgerStore } from '../ledger/memoryStore'
import { checkInvariants } from '../ledger/invariants'
import { levelId, type StockState } from '../ledger/types'
import { ReceivingError } from './errors'
import { MemoryPurchasingStore, type MemoryReceipt } from './memoryStore'
import { ReceivingService } from './ReceivingService'
import type { ReceiptLine } from './types'

const WH = 10 // Dubai warehouse
const OTHER_WH = 20
const DOCK = 1
const SHELF = 2
const FOREIGN_DOCK = 3

function setup() {
  const ledgerStore = new MemoryLedgerStore([
    { id: DOCK, market: 'ae', sellable: false },
    { id: SHELF, market: 'ae', sellable: true },
  ])
  const ledger = new LedgerService(ledgerStore)
  const store = new MemoryPurchasingStore(ledgerStore)
  store.addLocation(DOCK, WH)
  store.addLocation(SHELF, WH)
  store.addLocation(FOREIGN_DOCK, OTHER_WH)
  const receiving = new ReceivingService(store, ledger, () => new Date('2026-10-15T06:00:00Z'))
  store.addPurchaseOrder({
    id: 100,
    number: 'PO-2026-0100',
    warehouse: WH,
    market: 'ae',
    status: 'ordered',
    expectedAt: new Date('2026-11-02T00:00:00Z'),
    lines: [
      { id: 'L1', sku: 'MA352', qtyOrdered: 10, qtyReceived: 0, serialised: false },
      { id: 'L2', sku: 'MC462', qtyOrdered: 3, qtyReceived: 0, serialised: true },
    ],
  })
  let n = 0
  const receipt = (
    lines: Array<Partial<ReceiptLine> & { poLine: string }>,
    patch: Partial<MemoryReceipt> = {},
  ) => {
    const id = ++n
    store.addReceipt({
      id,
      number: `GR-${id}`,
      purchaseOrder: 100,
      location: DOCK,
      locationWarehouse: WH,
      lines: lines.map((l) => ({
        sku: l.poLine === 'L2' ? 'MC462' : 'MA352',
        qty: 1,
        serials: [],
        exceptions: [],
        ...l,
      })),
      ...patch,
    })
    return id
  }
  const level = (sku: string, location: number, state: StockState) =>
    ledgerStore.levels.find((l) => levelId(l) === levelId({ sku, location, state }))?.qty ?? 0
  return { ledgerStore, ledger, store, receiving, receipt, level }
}

async function refusal(work: Promise<unknown>): Promise<ReceivingError> {
  try {
    await work
  } catch (e) {
    if (e instanceof ReceivingError) return e
    throw e
  }
  throw new Error('expected a refusal')
}

describe('postReceipt', () => {
  it('books bulk and serialised lines into received, one movement per bulk line or serial', async () => {
    const { ledgerStore, store, receiving, receipt, level } = setup()
    const id = receipt([
      { poLine: 'L1', qty: 4 },
      { poLine: 'L2', qty: 2, serials: ['SN-1', 'SN-2'] },
    ])
    expect(await receiving.postReceipt(id, { user: 7 })).toEqual({
      booked: 6,
      quarantined: 0,
      unbooked: 0,
      poStatus: 'partially_received',
    })
    expect(
      ledgerStore.movements.map((m) => [
        m.sku,
        m.serial,
        m.qty,
        m.fromState,
        m.toState,
        m.docType,
        m.docId,
        m.user,
      ]),
    ).toEqual([
      ['MA352', null, 4, null, 'received', 'receipt', 'GR-1', 7],
      ['MC462', 'SN-1', 1, null, 'received', 'receipt', 'GR-1', 7],
      ['MC462', 'SN-2', 1, null, 'received', 'receipt', 'GR-1', 7],
    ])
    expect(level('MA352', DOCK, 'received')).toBe(4)
    expect(store.purchaseOrder(100)?.lines.map((l) => l.qtyReceived)).toEqual([4, 2])
    expect(store.receipt(id)?.status).toBe('posted')
    expect(checkInvariants(ledgerStore)).toEqual([])
  })

  it('moves the PO to received when the last outstanding unit arrives', async () => {
    const { store, receiving, receipt } = setup()
    await receiving.postReceipt(
      receipt([
        { poLine: 'L1', qty: 6 },
        { poLine: 'L2', qty: 1, serials: ['SN-1'] },
      ]),
    )
    expect(store.purchaseOrder(100)?.status).toBe('partially_received')
    const last = await receiving.postReceipt(
      receipt([
        { poLine: 'L1', qty: 4 },
        { poLine: 'L2', qty: 2, serials: ['SN-2', 'SN-3'] },
      ]),
    )
    expect(last.poStatus).toBe('received')
    expect(store.purchaseOrder(100)?.lines.map((l) => l.qtyOrdered - l.qtyReceived)).toEqual([0, 0])
  })

  it('posts once: a second post is refused and writes nothing', async () => {
    const { ledgerStore, receiving, receipt } = setup()
    const id = receipt([{ poLine: 'L1', qty: 2 }])
    await receiving.postReceipt(id)
    expect((await refusal(receiving.postReceipt(id))).code).toBe('receipt-already-posted')
    expect(ledgerStore.movements).toHaveLength(1)
  })

  it('posts once when two posts race', async () => {
    const { ledgerStore, receiving, receipt } = setup()
    const id = receipt([{ poLine: 'L1', qty: 2 }])
    const results = await Promise.allSettled([receiving.postReceipt(id), receiving.postReceipt(id)])
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(ledgerStore.movements).toHaveLength(1)
  })

  it('sends damaged units to quarantine and records nothing as available', async () => {
    const { receiving, receipt, level, ledgerStore } = setup()
    const id = receipt([
      { poLine: 'L1', qty: 5, exceptions: [{ type: 'damaged', qty: 2, note: 'Crushed cartons' }] },
      {
        poLine: 'L2',
        qty: 2,
        serials: ['SN-1', 'SN-2'],
        exceptions: [{ type: 'damaged', serials: ['SN-2'] }],
      },
    ])
    expect(await receiving.postReceipt(id)).toMatchObject({ booked: 7, quarantined: 3 })
    expect([level('MA352', DOCK, 'received'), level('MA352', DOCK, 'quarantine')]).toEqual([3, 2])
    expect(ledgerStore.serials.find((s) => s.serial === 'SN-2')?.state).toBe('quarantine')
    expect(level('MA352', DOCK, 'available') + level('MC462', DOCK, 'available')).toBe(0)
  })

  it('books units without a serial label later: missing_serial units are not booked', async () => {
    const { store, receiving, receipt } = setup()
    const id = receipt([
      {
        poLine: 'L2',
        qty: 3,
        serials: ['SN-1', 'SN-2'],
        exceptions: [{ type: 'missing_serial', qty: 1 }],
      },
    ])
    expect(await receiving.postReceipt(id)).toMatchObject({
      booked: 2,
      unbooked: 1,
      poStatus: 'partially_received',
    })
    expect(store.purchaseOrder(100)?.lines[1]?.qtyReceived).toBe(2)
  })

  it('books a wrong item under its own SKU, straight to quarantine, without filling the PO line', async () => {
    const { store, receiving, receipt, level } = setup()
    const id = receipt([
      {
        poLine: 'L1',
        sku: 'MA252',
        qty: 2,
        exceptions: [{ type: 'wrong_item', note: 'Supplier shipped MA252' }],
      },
    ])
    expect(await receiving.postReceipt(id)).toMatchObject({ booked: 2, quarantined: 2 })
    expect(level('MA252', DOCK, 'quarantine')).toBe(2)
    expect(store.purchaseOrder(100)?.lines[0]?.qtyReceived).toBe(0)
  })

  it('accepts extra units only with an over exception', async () => {
    const { receiving, receipt } = setup()
    expect((await refusal(receiving.postReceipt(receipt([{ poLine: 'L1', qty: 11 }])))).code).toBe(
      'over-receipt',
    )
    // Split across two lines of the same receipt is still over.
    expect(
      (
        await refusal(
          receiving.postReceipt(
            receipt([
              { poLine: 'L1', qty: 6 },
              { poLine: 'L1', qty: 5 },
            ]),
          ),
        )
      ).code,
    ).toBe('over-receipt')
    expect(
      await receiving.postReceipt(
        receipt([
          {
            poLine: 'L1',
            qty: 11,
            exceptions: [{ type: 'over', qty: 1, note: 'Supplier sent a spare' }],
          },
        ]),
      ),
    ).toMatchObject({ poStatus: 'partially_received' })
  })

  it.each([
    ['a missing serial', { poLine: 'L2', qty: 2, serials: ['SN-1'] }, 'serial-missing', undefined],
    ['a blank serial', { poLine: 'L2', qty: 1, serials: [' '] }, 'serial-missing', undefined],
    [
      'a serial scanned twice',
      { poLine: 'L2', qty: 2, serials: ['SN-1', 'SN-1'] },
      'serial-duplicate',
      'SN-1',
    ],
    [
      'a serial on a bulk line',
      { poLine: 'L1', qty: 1, serials: ['X'] },
      'serial-not-allowed',
      undefined,
    ],
    [
      'the wrong SKU without an exception',
      { poLine: 'L1', sku: 'MA252', qty: 1 },
      'sku-mismatch',
      undefined,
    ],
    ['an unknown PO line', { poLine: 'L9', qty: 1 }, 'unknown-po-line', undefined],
    ['a zero quantity', { poLine: 'L1', qty: 0 }, 'invalid-quantity', undefined],
    [
      'an exception larger than the line',
      { poLine: 'L1', qty: 1, exceptions: [{ type: 'damaged', qty: 2 }] },
      'invalid-exception',
      undefined,
    ],
    [
      'an exception on a serial not scanned',
      {
        poLine: 'L2',
        qty: 1,
        serials: ['SN-1'],
        exceptions: [{ type: 'damaged', serials: ['SN-9'] }],
      },
      'invalid-exception',
      'SN-9',
    ],
    [
      'an unknown exception',
      { poLine: 'L1', qty: 1, exceptions: [{ type: 'lost' as never }] },
      'invalid-exception',
      undefined,
    ],
  ] as const)('refuses %s', async (_name, line, code, serial) => {
    const { ledgerStore, receiving, receipt } = setup()
    const error = await refusal(receiving.postReceipt(receipt([line])))
    expect(error.code).toBe(code)
    if (serial) {
      expect(error.detail?.serial).toBe(serial)
      expect(error.message).toContain(serial)
    }
    expect(ledgerStore.movements).toHaveLength(0)
  })

  it('refuses a serial already in stock and names it', async () => {
    const { ledger, receiving, receipt } = setup()
    await ledger.move({
      sku: 'MC462',
      qty: 1,
      serial: 'SN-7',
      from: null,
      to: 'available',
      location: SHELF,
      doc: { type: 'opening', id: 'OPEN' },
    })
    const error = await refusal(
      receiving.postReceipt(receipt([{ poLine: 'L2', qty: 1, serials: ['SN-7'] }])),
    )
    expect(error).toMatchObject({ code: 'serial-duplicate', detail: { serial: 'SN-7' } })
  })

  it.each([
    ['a cancelled PO', 'cancelled'],
    ['a closed PO', 'closed'],
    ['a draft PO', 'draft'],
  ] as const)('refuses to receive against %s', async (_n, status) => {
    const { store, receiving, receipt } = setup()
    const po = store.purchaseOrder(100)
    if (po) po.status = status
    expect((await refusal(receiving.postReceipt(receipt([{ poLine: 'L1', qty: 1 }])))).code).toBe(
      'po-not-open',
    )
  })

  it('refuses a receipt at another warehouse, an empty receipt and an unknown receipt', async () => {
    const { receiving, receipt } = setup()
    expect(
      (
        await refusal(
          receiving.postReceipt(
            receipt([{ poLine: 'L1', qty: 1 }], {
              location: FOREIGN_DOCK,
              locationWarehouse: OTHER_WH,
            }),
          ),
        )
      ).code,
    ).toBe('wrong-warehouse')
    expect((await refusal(receiving.postReceipt(receipt([])))).code).toBe('receipt-empty')
    expect((await refusal(receiving.postReceipt(999))).code).toBe('receipt-not-found')
  })

  it('refuses a missing PO', async () => {
    const { receiving, receipt } = setup()
    expect(
      (
        await refusal(
          receiving.postReceipt(receipt([{ poLine: 'L1', qty: 1 }], { purchaseOrder: 404 })),
        )
      ).code,
    ).toBe('po-not-open')
  })
})

describe('putaway', () => {
  it('moves the good units to available, leaving damaged ones in quarantine', async () => {
    const { ledger, receiving, receipt, level, ledgerStore } = setup()
    const id = receipt([
      { poLine: 'L1', qty: 5, exceptions: [{ type: 'damaged', qty: 1 }] },
      {
        poLine: 'L2',
        qty: 2,
        serials: ['SN-1', 'SN-2'],
        exceptions: [{ type: 'damaged', serials: ['SN-1'] }],
      },
    ])
    await receiving.postReceipt(id)
    expect(await receiving.putaway(id, { location: SHELF, user: 7 })).toEqual({ available: 5 })
    expect([
      level('MA352', DOCK, 'received'),
      level('MA352', SHELF, 'available'),
      level('MA352', DOCK, 'quarantine'),
    ]).toEqual([0, 4, 1])
    expect(ledgerStore.serials.find((s) => s.serial === 'SN-2')).toMatchObject({
      state: 'available',
      location: SHELF,
    })
    expect(await ledger.sellable('MA352', 'ae')).toBe(4)
    expect(checkInvariants(ledgerStore)).toEqual([])
  })

  it('puts away in place when the target is the receiving location', async () => {
    const { receiving, receipt, level } = setup()
    const id = receipt([{ poLine: 'L1', qty: 3 }])
    await receiving.postReceipt(id)
    await receiving.putaway(id, { location: DOCK })
    expect(level('MA352', DOCK, 'available')).toBe(3)
  })

  it('leaves wrong items in quarantine', async () => {
    const { receiving, receipt, level } = setup()
    const id = receipt([
      { poLine: 'L1', sku: 'MA252', qty: 2, exceptions: [{ type: 'wrong_item' }] },
    ])
    await receiving.postReceipt(id)
    expect(await receiving.putaway(id, { location: SHELF })).toEqual({ available: 0 })
    expect(level('MA252', DOCK, 'quarantine')).toBe(2)
  })

  it('refuses before posting, twice, or for an unknown receipt', async () => {
    const { receiving, receipt } = setup()
    const id = receipt([{ poLine: 'L1', qty: 1 }])
    expect((await refusal(receiving.putaway(id, { location: SHELF }))).code).toBe(
      'receipt-not-posted',
    )
    await receiving.postReceipt(id)
    await receiving.putaway(id, { location: SHELF })
    expect((await refusal(receiving.putaway(id, { location: SHELF }))).code).toBe(
      'receipt-already-put-away',
    )
    expect((await refusal(receiving.putaway(999, { location: SHELF }))).code).toBe(
      'receipt-not-found',
    )
    const orphan = receipt([{ poLine: 'L1', qty: 1 }], { purchaseOrder: 404, status: 'posted' })
    expect((await refusal(receiving.putaway(orphan, { location: SHELF }))).code).toBe(
      'receipt-not-found',
    )
  })

  it('refuses a target location that is unknown or in another warehouse', async () => {
    const { receiving, receipt, level } = setup()
    const id = receipt([{ poLine: 'L1', qty: 2 }])
    await receiving.postReceipt(id)
    expect((await refusal(receiving.putaway(id, { location: 404 }))).code).toBe('unknown-location')
    expect((await refusal(receiving.putaway(id, { location: FOREIGN_DOCK }))).code).toBe(
      'wrong-warehouse',
    )
    expect(level('MA352', DOCK, 'received')).toBe(2)
  })
})

describe('openPurchaseEta', () => {
  it('returns the earliest open expected date with outstanding stock, or none', async () => {
    const { store, receiving, receipt } = setup()
    store.addPurchaseOrder({
      id: 101,
      number: 'PO-101',
      warehouse: WH,
      market: 'ae',
      status: 'ordered',
      expectedAt: new Date('2026-10-20T00:00:00Z'),
      lines: [{ id: 'X1', sku: 'MA352', qtyOrdered: 1, qtyReceived: 0, serialised: false }],
    })
    store.addPurchaseOrder({
      id: 102,
      number: 'PO-102',
      warehouse: WH,
      market: 'ae',
      status: 'cancelled',
      expectedAt: new Date('2026-10-16T00:00:00Z'),
      lines: [{ id: 'X1', sku: 'MA352', qtyOrdered: 1, qtyReceived: 0, serialised: false }],
    })
    store.addPurchaseOrder({
      id: 103,
      number: 'PO-103',
      warehouse: OTHER_WH,
      market: 'sa',
      status: 'ordered',
      expectedAt: new Date('2026-10-17T00:00:00Z'),
      lines: [{ id: 'X1', sku: 'MA352', qtyOrdered: 1, qtyReceived: 0, serialised: false }],
    })
    expect(await receiving.openPurchaseEta('MA352', 'ae')).toEqual(new Date('2026-10-20T00:00:00Z'))
    expect(await receiving.openPurchaseEta('MA352', 'sa')).toEqual(new Date('2026-10-17T00:00:00Z'))
    expect(await receiving.openPurchaseEta('NOPE', 'ae')).toBeNull()

    await receiving.postReceipt(receipt([{ poLine: 'L2', qty: 3, serials: ['A', 'B', 'C'] }]))
    expect(await receiving.openPurchaseEta('MC462', 'ae')).toBeNull() // fully received
  })
})
