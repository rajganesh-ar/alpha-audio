import { describe, expect, it, vi } from 'vitest'
import { LedgerService } from '../ledger/LedgerService'
import { MemoryLedgerStore } from '../ledger/memoryStore'
import { levelId, type Id, type StockState } from '../ledger/types'
import { money } from '../money'
import type { PaymentProvider } from '../payments/types'
import { FulfilmentService } from './FulfilmentService'
import { MemoryFulfilmentStore } from './memoryStore'
import type { FulfilmentOrder, Notify } from './types'

const DXB = 1
const aed = (n: number) => money(n, 'AED', 2)

async function setup(options: { refund?: PaymentProvider['refund'] | null } = {}) {
  const ledgerStore = new MemoryLedgerStore([{ id: DXB, market: 'ae', sellable: true }])
  const ledger = new LedgerService(ledgerStore, () => new Date('2026-10-15T08:00:00Z'))
  const level = (sku: string, state: StockState) =>
    ledgerStore.levels.find((l) => levelId(l) === levelId({ sku, location: DXB, state }))?.qty ?? 0
  await ledger.move({
    sku: 'AMP',
    qty: 3,
    from: null,
    to: 'available',
    location: DXB,
    doc: { type: 'opening', id: 'OB' },
  })
  for (const serial of ['SN-1', 'SN-2'])
    await ledger.move({
      sku: 'SPK',
      qty: 1,
      serial,
      from: null,
      to: 'available',
      location: DXB,
      doc: { type: 'opening', id: 'OB' },
    })

  const store = new MemoryFulfilmentStore()
  const holds: Id[] = []
  for (const [sku, qty] of [
    ['AMP', 2],
    ['SPK', 2],
  ] as const) {
    const r = await ledger.reserve({
      sku,
      qty,
      market: 'ae',
      doc: { type: 'order', id: 'AE-2026-000001' },
    })
    if (!r.ok) throw new Error('reserve failed')
    holds.push(r.reservation.id)
  }
  const order: FulfilmentOrder = {
    id: 1,
    number: 'AE-2026-000001',
    market: 'ae',
    status: 'confirmed',
    failureReason: null,
    fulfilment: 'awaiting',
    lines: [],
    totals: { subtotal: aed(500_000), vat: aed(23_810), delivery: aed(0), total: aed(500_000) },
    reservations: holds,
    payment: { provider: 'test', intentId: 'pi_1', status: 'captured' },
    refund: { status: 'none', amount: null, reference: null, error: null },
    shipment: null,
    cancelReason: null,
  }
  store.add(order)
  const refund = vi.fn(async () => ({ refundId: 'rf_1' }))
  const provider =
    options.refund === null
      ? null
      : ({
          id: 'test',
          methods: ['card'],
          createPayment: vi.fn(),
          parseWebhook: vi.fn(),
          refund: options.refund ?? refund,
        } as unknown as PaymentProvider)
  const notify = vi.fn<Notify>(async () => undefined)
  const service = new FulfilmentService(
    store,
    ledger,
    provider,
    notify,
    () => new Date('2026-10-15T09:00:00Z'),
  )
  return { service, store, ledger, ledgerStore, level, notify, refund, order }
}

const shipment = {
  courier: 'Aramex',
  trackingNumber: '4421 9988 01',
  trackingUrl: 'https://www.aramex.com/track/4421998801',
}

describe('FulfilmentService', () => {
  it('picks, ships and delivers every hold, serials included, and notifies at shipping and delivery', async () => {
    const { service, store, level, ledgerStore, notify } = await setup()
    expect(await service.pick('AE-2026-000001')).toMatchObject({
      ok: true,
      changed: true,
      order: { fulfilment: 'picked' },
    })
    expect([level('AMP', 'picked'), level('SPK', 'picked')]).toEqual([2, 2])

    const shipped = await service.ship('AE-2026-000001', shipment)
    expect(shipped).toMatchObject({
      ok: true,
      order: { fulfilment: 'shipped', shipment: { number: 'SH-2026-000001' } },
    })
    expect([level('AMP', 'shipped'), level('SPK', 'shipped')]).toEqual([2, 2])
    expect(ledgerStore.serials.map((s) => s.state)).toEqual(['shipped', 'shipped'])
    expect(store.shipments.get('AE-2026-000001')).toMatchObject({
      courier: 'Aramex',
      trackingNumber: '4421 9988 01',
    })

    expect(await service.deliver('AE-2026-000001')).toMatchObject({
      ok: true,
      order: { fulfilment: 'delivered' },
    })
    expect([
      level('AMP', 'delivered'),
      level('SPK', 'delivered'),
      level('AMP', 'available'),
    ]).toEqual([2, 2, 1])
    expect(store.shipments.get('AE-2026-000001')?.deliveredAt).toEqual(
      new Date('2026-10-15T09:00:00Z'),
    )
    expect(notify.mock.calls.map((c) => c[1])).toEqual(['order-shipped', 'order-delivered'])
  })

  it('is idempotent: repeating or racing a step changes nothing more', async () => {
    const { service, level, notify } = await setup()
    const [a, b] = await Promise.all([
      service.pick('AE-2026-000001'),
      service.pick('AE-2026-000001'),
    ])
    expect([a.ok, b.ok]).toEqual([true, true])
    expect(await service.pick('AE-2026-000001')).toMatchObject({ ok: true, changed: false })
    expect(level('AMP', 'picked')).toBe(2)
    await Promise.all([
      service.ship('AE-2026-000001', shipment),
      service.ship('AE-2026-000001', shipment),
    ])
    expect(level('AMP', 'shipped')).toBe(2)
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('resumes a step that died half-way', async () => {
    const { service, store, ledger, order, level } = await setup()
    // As if a pick crashed after the first hold: the order is claimed, one hold picked.
    await store.transition(order.id, ['awaiting'], 'picking')
    await ledger.pick(order.reservations[0] as Id)
    expect(await service.pick('AE-2026-000001')).toMatchObject({
      ok: true,
      order: { fulfilment: 'picked' },
    })
    expect([level('AMP', 'picked'), level('SPK', 'picked')]).toEqual([2, 2])
  })

  it('refuses steps out of order, unconfirmed orders and bad shipment details', async () => {
    const { service, store } = await setup()
    expect(await service.ship('AE-2026-000001', shipment)).toMatchObject({
      ok: false,
      reason: 'wrong-status',
    })
    expect(await service.deliver('AE-2026-000001')).toMatchObject({
      ok: false,
      reason: 'wrong-status',
    })
    expect(await service.pick('AE-2026-999999')).toEqual({ ok: false, reason: 'not-found' })
    await service.pick('AE-2026-000001')
    for (const bad of [
      { courier: '', trackingNumber: 'ABC123' },
      { courier: 'Aramex', trackingNumber: '#!' },
      { courier: 'Aramex', trackingNumber: 'ABC123', trackingUrl: 'http://insecure.example/x' },
    ]) {
      expect(await service.ship('AE-2026-000001', bad)).toEqual({
        ok: false,
        reason: 'invalid-shipment',
      })
    }
    const current = await store.findByNumber('AE-2026-000001')
    if (!current) throw new Error('order missing')
    const unpaid = {
      ...current,
      number: 'AE-2026-000002',
      id: 2,
      status: 'paying' as const,
    }
    store.add(unpaid)
    expect(await service.pick('AE-2026-000002')).toMatchObject({
      ok: false,
      reason: 'not-confirmed',
    })
  })

  it('reports a hold that is no longer there', async () => {
    const { service, ledger, order } = await setup()
    await ledger.release(order.reservations[1] as Id)
    expect(await service.pick('AE-2026-000001')).toMatchObject({
      ok: false,
      reason: 'hold-missing',
    })
  })

  it('cancels before shipment: stock back to available, full refund, customer told', async () => {
    const { service, level, refund, notify } = await setup()
    await service.pick('AE-2026-000001')
    const result = await service.cancel('AE-2026-000001', 'Customer changed their mind')
    expect(result).toMatchObject({
      ok: true,
      order: {
        fulfilment: 'cancelled',
        cancelReason: 'Customer changed their mind',
        refund: { status: 'refunded', reference: 'rf_1' },
      },
    })
    expect([level('AMP', 'available'), level('SPK', 'available'), level('AMP', 'picked')]).toEqual([
      3, 2, 0,
    ])
    expect(refund).toHaveBeenCalledWith(
      expect.objectContaining({
        intentId: 'pi_1',
        idempotencyKey: 'refund:AE-2026-000001',
        amount: aed(500_000),
      }),
    )
    expect(notify.mock.calls.map((c) => c[1])).toEqual(['order-cancelled'])
    // A second refund is never paid.
    expect(await service.refund('AE-2026-000001')).toMatchObject({ ok: true, changed: false })
    expect(refund).toHaveBeenCalledTimes(1)
  })

  it('cancels an order not yet picked, and never one that has shipped', async () => {
    const first = await setup()
    expect(await first.service.cancel('AE-2026-000001', 'Fraud check')).toMatchObject({ ok: true })
    expect(first.level('AMP', 'available')).toBe(3)
    expect(await first.service.cancel('AE-2026-000001', '  ')).toMatchObject({ ok: false })

    const second = await setup()
    await second.service.pick('AE-2026-000001')
    await second.service.ship('AE-2026-000001', shipment)
    expect(await second.service.cancel('AE-2026-000001', 'Too late')).toMatchObject({
      ok: false,
      reason: 'wrong-status',
    })
    expect(second.level('AMP', 'shipped')).toBe(2)
  })

  it('leaves a refund manual without a refunding provider, and failed (retryable) on an error', async () => {
    const manual = await setup({ refund: null })
    expect(await manual.service.cancel('AE-2026-000001', 'Out of stock locally')).toMatchObject({
      ok: true,
      order: { refund: { status: 'manual', amount: aed(500_000) } },
    })

    let calls = 0
    const flaky = await setup({
      refund: async () => {
        if (++calls === 1) throw new Error('gateway timeout')
        return { refundId: 'rf_2' }
      },
    })
    expect(await flaky.service.cancel('AE-2026-000001', 'Duplicate order')).toMatchObject({
      order: { fulfilment: 'cancelled', refund: { status: 'failed', error: 'gateway timeout' } },
    })
    expect(await flaky.service.refund('AE-2026-000001')).toMatchObject({
      ok: true,
      order: { refund: { status: 'refunded', reference: 'rf_2' } },
    })
  })

  it('refunds a paid order that failed because its stock had gone, and nothing else', async () => {
    const { service, store, order } = await setup()
    expect(await service.refund('AE-2026-000001')).toMatchObject({
      ok: false,
      reason: 'not-refundable',
    })
    store.add({
      ...order,
      id: 3,
      number: 'AE-2026-000003',
      status: 'failed',
      failureReason: 'stock-lost',
      reservations: [],
    })
    expect(await service.refund('AE-2026-000003')).toMatchObject({
      ok: true,
      order: { refund: { status: 'refunded' } },
    })
    store.add({
      ...order,
      id: 4,
      number: 'AE-2026-000004',
      status: 'failed',
      failureReason: 'declined',
      payment: { ...order.payment, status: 'declined' },
    })
    expect(await service.refund('AE-2026-000004')).toMatchObject({
      ok: false,
      reason: 'not-refundable',
    })
    expect(await service.refund('AE-2026-999999')).toEqual({ ok: false, reason: 'not-found' })
  })
})
