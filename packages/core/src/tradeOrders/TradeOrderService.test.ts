import { describe, expect, it } from 'vitest'
import { LedgerService } from '../ledger/LedgerService'
import { MemoryLedgerStore } from '../ledger/memoryStore'
import { levelId, type StockState } from '../ledger/types'
import { money } from '../money'
import { TradeOrderService, type SubmitInput } from './TradeOrderService'
import { MemoryTradeOrderStore } from './memoryStore'
import type { TradeLine } from './types'

const DXB = 1
const aed = (n: bigint) => money(n, 'AED', 2)
let clock = new Date('2026-10-15T08:00:00Z')

async function setup(stock: Record<string, number> = { AMP: 5, SPK: 5 }) {
  clock = new Date('2026-10-15T08:00:00Z')
  const ledgerStore = new MemoryLedgerStore([{ id: DXB, market: 'ae', sellable: true }])
  const ledger = new LedgerService(ledgerStore, () => clock)
  for (const [sku, qty] of Object.entries(stock))
    await ledger.move({
      sku,
      qty,
      from: null,
      to: 'available',
      location: DXB,
      doc: { type: 'opening', id: 'OB' },
    })
  const store = new MemoryTradeOrderStore()
  const service = new TradeOrderService(store, ledger, () => clock)
  const level = (sku: string, state: StockState) =>
    ledgerStore.levels.find((l) => levelId(l) === levelId({ sku, location: DXB, state }))?.qty ?? 0
  return { service, store, ledger, level }
}

const line = (
  sku: string,
  qty: number,
  unit: bigint,
  status: TradeLine['status'] = 'ok',
): TradeLine => ({
  sku,
  productId: sku,
  title: sku,
  qty,
  status,
  unit: aed(unit),
  total: aed(unit * BigInt(qty)),
  vat: aed((unit * BigInt(qty) * 5n) / 100n),
  basis: 'dealer-list',
  trace: [],
})

function order(lines: TradeLine[], overrides: Partial<SubmitInput> = {}): SubmitInput {
  const net = lines.reduce((s, l) => s + (l.total?.amount ?? 0n), 0n)
  const vat = lines.reduce((s, l) => s + (l.vat?.amount ?? 0n), 0n)
  return {
    company: {
      id: 7,
      market: 'ae',
      hold: false,
      creditLimit: 5_000_000n,
      rules: { orderMultiple: null, minOrderValue: null },
    },
    placer: { id: 70, role: 'owner', approvalThreshold: null },
    idempotencyKey: `k-${Math.random()}`,
    lines,
    totals: { net: aed(net), vat: aed(vat), gross: aed(net + vat) },
    details: { poNumber: 'PO-1' },
    ...overrides,
  }
}

describe('TradeOrderService.submit', () => {
  it('confirms an order that needs no approval and holds its stock for good', async () => {
    const { service, level } = await setup()
    const result = await service.submit(order([line('AMP', 2, 100_000n), line('SPK', 1, 50_000n)]))
    expect(result).toMatchObject({
      ok: true,
      created: true,
      order: {
        number: 'T-AE-2026-000001',
        status: 'confirmed',
        holdExpiresAt: null,
        approvals: [],
      },
    })
    expect([level('AMP', 'reserved'), level('SPK', 'reserved'), level('AMP', 'available')]).toEqual(
      [2, 1, 3],
    )
  })

  it('is idempotent on the company-scoped key, including for parallel submits', async () => {
    const { service, store, level } = await setup()
    const input = order([line('AMP', 1, 100_000n)], { idempotencyKey: 'same' })
    const [a, b] = await Promise.all([service.submit(input), service.submit(input)])
    const again = await service.submit(input)
    expect(store.orders).toHaveLength(1)
    expect(store.orders[0]?.idempotencyKey).toBe('7:same')
    expect(again).toMatchObject({ ok: true, created: false, order: { status: 'confirmed' } })
    expect([a.ok || a.reason, b.ok || b.reason].sort()).toEqual(expect.arrayContaining([true]))
    expect(level('AMP', 'reserved')).toBe(1)
    // Another company may use the same key.
    const other = await service.submit({ ...input, company: { ...input.company, id: 8 } })
    expect(other).toMatchObject({ ok: true, created: true })
  })

  it('refuses viewers, accounts on hold and rule failures, reserving nothing', async () => {
    const { service, store, level } = await setup()
    const lines = [line('AMP', 3, 100_000n)]
    expect(
      await service.submit(
        order(lines, { placer: { id: 1, role: 'viewer', approvalThreshold: null } }),
      ),
    ).toEqual({ ok: false, reason: 'not-allowed' })
    const held = order(lines)
    expect(await service.submit({ ...held, company: { ...held.company, hold: true } })).toEqual({
      ok: false,
      reason: 'on-hold',
    })
    const ruled = order(lines)
    const result = await service.submit({
      ...ruled,
      company: { ...ruled.company, rules: { orderMultiple: 2, minOrderValue: 1_000_000n } },
    })
    expect(result).toMatchObject({
      ok: false,
      reason: 'rules',
      problems: {
        lines: [{ sku: 'AMP', problem: 'multiple', multiple: 2 }],
        order: [{ problem: 'minimum-value' }],
      },
    })
    expect(store.orders).toHaveLength(0)
    expect(level('AMP', 'reserved')).toBe(0)
  })

  it('holds all lines or none when stock is short', async () => {
    const { service, level } = await setup({ AMP: 5, SPK: 1 })
    const input = order([line('AMP', 2, 100_000n), line('SPK', 2, 50_000n)])
    const result = await service.submit(input)
    expect(result).toMatchObject({ ok: false, reason: 'unavailable', skus: ['SPK'] })
    expect(level('AMP', 'reserved')).toBe(0)
    expect(await service.submit(input)).toMatchObject({ ok: false, reason: 'unavailable' })
  })

  it('reports an order still reserving under the same key', async () => {
    const { service, store } = await setup()
    const input = order([line('AMP', 1, 100_000n)], { idempotencyKey: 'slow' })
    await store.insertOrder({
      number: 'T-AE-2026-000099',
      company: 7,
      placedBy: 70,
      market: 'ae',
      status: 'reserving',
      idempotencyKey: '7:slow',
      lines: input.lines,
      totals: input.totals,
      approvals: [],
      reservations: [],
      holdExpiresAt: null,
      failureReason: null,
      unavailableSkus: [],
      closedReason: null,
      details: {},
    })
    expect(await service.submit(input)).toMatchObject({ ok: false, reason: 'in-progress' })
    expect(await service.decide('T-AE-2026-000099', { kind: 'company', by: 1 }, 'approve')).toEqual(
      { ok: false, reason: 'not-pending' },
    )
  })

  it('never lets parallel orders overspend the credit check', async () => {
    const { service } = await setup({ AMP: 100 })
    // Each order is 1,050,000 gross; a 3,000,000 limit fits two.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        service.submit(
          order([line('AMP', 1, 1_000_000n)], {
            company: {
              id: 7,
              market: 'ae',
              hold: false,
              creditLimit: 3_000_000n,
              rules: { orderMultiple: null, minOrderValue: null },
            },
          }),
        ),
      ),
    )
    const statuses = results.map((r) => (r.ok ? r.order.status : r.reason))
    expect(statuses.filter((s) => s === 'confirmed')).toHaveLength(2)
    expect(statuses.filter((s) => s === 'pending-approval')).toHaveLength(8)
  })
})

describe('TradeOrderService.preview', () => {
  it('reports rule problems, approvals and credit used without placing anything', async () => {
    const { service, store } = await setup()
    await service.submit(order([line('AMP', 1, 1_000_000n)]))
    const input = order([line('AMP', 4, 1_000_000n)])
    const preview = await service.preview({
      ...input,
      company: { ...input.company, rules: { orderMultiple: 3, minOrderValue: null } },
    })
    expect(preview).toMatchObject({
      creditUsed: 1_050_000n,
      problems: { lines: [{ sku: 'AMP', problem: 'multiple' }] },
      approvals: [{ kind: 'alpha', reason: 'credit' }],
    })
    expect(store.orders).toHaveLength(1)
  })
})

describe('TradeOrderService approvals', () => {
  const purchaser = { id: 71, role: 'purchaser', approvalThreshold: 150_000n }

  it('waits for the owner, then confirms and makes the holds permanent', async () => {
    const { service, level } = await setup()
    const placed = await service.submit(order([line('AMP', 2, 100_000n)], { placer: purchaser }))
    expect(placed).toMatchObject({
      ok: true,
      order: {
        status: 'pending-approval',
        holdExpiresAt: new Date('2026-10-18T08:00:00Z'),
        approvals: [{ kind: 'company', reason: 'threshold', status: 'pending' }],
      },
    })
    const number = placed.ok ? placed.order.number : ''
    expect(await service.decide(number, { kind: 'alpha', by: 1 }, 'approve')).toEqual({
      ok: false,
      reason: 'nothing-to-decide',
    })
    const approved = await service.decide(number, { kind: 'company', by: 70 }, 'approve', 'OK')
    expect(approved).toMatchObject({
      ok: true,
      order: {
        status: 'confirmed',
        holdExpiresAt: null,
        approvals: [{ status: 'approved', by: 70, note: 'OK', at: clock }],
      },
    })
    expect(level('AMP', 'reserved')).toBe(2)
    expect(await service.decide(number, { kind: 'company', by: 70 }, 'approve')).toEqual({
      ok: false,
      reason: 'not-pending',
    })
  })

  it('needs every approval: the company and Alpha', async () => {
    const { service } = await setup()
    const placed = await service.submit(
      order([line('AMP', 2, 100_000n, 'needs-approval')], { placer: purchaser }),
    )
    const number = placed.ok ? placed.order.number : ''
    const first = await service.decide(number, { kind: 'alpha', by: 1 }, 'approve')
    expect(first).toMatchObject({ ok: true, order: { status: 'pending-approval' } })
    expect(await service.decide(number, { kind: 'company', by: 70 }, 'approve')).toMatchObject({
      ok: true,
      order: { status: 'confirmed' },
    })
  })

  it('releases stock when rejected or cancelled', async () => {
    const { service, level } = await setup()
    const a = await service.submit(order([line('AMP', 2, 100_000n)], { placer: purchaser }))
    const rejected = await service.decide(
      a.ok ? a.order.number : '',
      { kind: 'company', by: 70 },
      'reject',
      'Too many',
    )
    expect(rejected).toMatchObject({
      ok: true,
      order: { status: 'rejected', closedReason: 'Too many', approvals: [{ status: 'rejected' }] },
    })
    const b = await service.submit(order([line('AMP', 3, 100_000n)], { placer: purchaser }))
    const number = b.ok ? b.order.number : ''
    expect(level('AMP', 'reserved')).toBe(3)
    expect(await service.cancel(number, 'Ordered by mistake')).toMatchObject({
      ok: true,
      order: { status: 'cancelled', closedReason: 'Ordered by mistake' },
    })
    expect(level('AMP', 'reserved')).toBe(0)
    expect(await service.cancel(number)).toEqual({ ok: false, reason: 'not-pending' })
    expect(await service.cancel('T-NOPE')).toEqual({ ok: false, reason: 'not-found' })
    expect(await service.decide('T-NOPE', { kind: 'company', by: 1 }, 'approve')).toEqual({
      ok: false,
      reason: 'not-found',
    })
  })

  it('lets only one of two racing approvers decide', async () => {
    const { service, level } = await setup()
    const placed = await service.submit(order([line('AMP', 2, 100_000n)], { placer: purchaser }))
    const number = placed.ok ? placed.order.number : ''
    const results = await Promise.all([
      service.decide(number, { kind: 'company', by: 70 }, 'approve'),
      service.decide(number, { kind: 'company', by: 72 }, 'reject'),
    ])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.reason)).toEqual(['busy'])
    expect(await service.cancel(number)).toMatchObject({ ok: false })
    // While a decision is being recorded, others are told to try again.
    const next = await service.submit(order([line('SPK', 2, 100_000n)], { placer: purchaser }))
    const busy = next.ok ? next.order : null
    const [decision, cancel] = await Promise.all([
      service.decide(busy?.number ?? '', { kind: 'company', by: 70 }, 'approve'),
      service.cancel(busy?.number ?? ''),
    ])
    expect([decision.ok, cancel.ok].filter(Boolean)).toHaveLength(1)
    expect([0, 2]).toContain(level('AMP', 'reserved'))
  })

  it('re-holds lapsed stock on approval, or fails the order when it is gone', async () => {
    const { service, ledger, level } = await setup({ AMP: 2 })
    const placed = await service.submit(order([line('AMP', 2, 100_000n)], { placer: purchaser }))
    const number = placed.ok ? placed.order.number : ''
    clock = new Date('2026-10-19T08:00:00Z')
    await ledger.releaseExpiredReservations()
    expect(level('AMP', 'available')).toBe(2)
    expect(await service.decide(number, { kind: 'company', by: 70 }, 'approve')).toMatchObject({
      ok: true,
      order: { status: 'confirmed' },
    })
    expect(level('AMP', 'reserved')).toBe(2)

    const second = await setup({ AMP: 2 })
    const other = await second.service.submit(
      order([line('AMP', 2, 100_000n)], { placer: purchaser }),
    )
    clock = new Date('2026-10-19T08:00:00Z')
    await second.ledger.releaseExpiredReservations()
    await second.ledger.reserve({
      sku: 'AMP',
      qty: 1,
      market: 'ae',
      doc: { type: 'cart', id: 'C' },
    })
    expect(
      await second.service.decide(
        other.ok ? other.order.number : '',
        { kind: 'company', by: 70 },
        'approve',
      ),
    ).toMatchObject({ ok: true, order: { status: 'failed', failureReason: 'stock-lost' } })
    expect(second.level('AMP', 'reserved')).toBe(1)
  })
})
