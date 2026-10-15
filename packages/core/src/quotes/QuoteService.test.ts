import { describe, expect, it } from 'vitest'
import { LedgerService } from '../ledger/LedgerService'
import { MemoryLedgerStore } from '../ledger/memoryStore'
import { levelId, type StockState } from '../ledger/types'
import { money } from '../money'
import { MemoryTradeOrderStore } from '../tradeOrders/memoryStore'
import { TradeOrderService, type SubmitInput } from '../tradeOrders/TradeOrderService'
import type { TradeLine } from '../tradeOrders/types'
import { MemoryQuoteStore } from './memoryStore'
import { QuoteService, type CreateQuoteInput } from './QuoteService'

const DXB = 1
const aed = (n: bigint) => money(n, 'AED', 2)
let clock = new Date('2026-10-15T08:00:00Z')

async function setup(stock: Record<string, number> = { AMP: 5, SPK: 1 }) {
  clock = new Date('2026-10-15T08:00:00Z')
  const ledgerStore = new MemoryLedgerStore([{ id: DXB, market: 'ae', sellable: true }])
  const ledger = new LedgerService(ledgerStore, () => clock)
  for (const [sku, qty] of Object.entries(stock).filter(([, q]) => q > 0))
    await ledger.move({
      sku,
      qty,
      from: null,
      to: 'available',
      location: DXB,
      doc: { type: 'opening', id: 'OB' },
    })
  const orderStore = new MemoryTradeOrderStore()
  const orders = new TradeOrderService(orderStore, ledger, () => clock)
  const store = new MemoryQuoteStore()
  const quotes = new QuoteService(store, ledger, orders, () => clock)
  const level = (sku: string, state: StockState) =>
    ledgerStore.levels.find((l) => levelId(l) === levelId({ sku, location: DXB, state }))?.qty ?? 0
  return { quotes, store, orders, orderStore, ledger, ledgerStore, level }
}

const line = (sku: string, qty: number, unit: bigint): TradeLine => ({
  sku,
  productId: sku,
  title: sku,
  qty,
  status: 'ok',
  unit: aed(unit),
  total: aed(unit * BigInt(qty)),
  vat: aed((unit * BigInt(qty) * 5n) / 100n),
  basis: 'contract',
  trace: [{ rule: 'contract', seen: true, matched: true, value: '1000.00' }],
})

function quoteInput(
  lines: TradeLine[],
  overrides: Partial<CreateQuoteInput> = {},
): CreateQuoteInput {
  const net = lines.reduce((s, l) => s + (l.total?.amount ?? 0n), 0n)
  const vat = lines.reduce((s, l) => s + (l.vat?.amount ?? 0n), 0n)
  return {
    company: { id: 7, market: 'ae' },
    creator: { id: 70, role: 'purchaser' },
    idempotencyKey: `q-${Math.random()}`,
    lines,
    totals: { net: aed(net), vat: aed(vat), gross: aed(net + vat) },
    fxRates: { USD: '3.672500' },
    details: { reference: 'Villa 12' },
    ...overrides,
  }
}

const orderParties: Pick<SubmitInput, 'company' | 'placer' | 'details'> = {
  company: {
    id: 7,
    market: 'ae',
    hold: false,
    creditLimit: 10_000_000n,
    rules: { orderMultiple: null, minOrderValue: null },
  },
  placer: { id: 70, role: 'owner', approvalThreshold: null },
  details: {},
}

describe('QuoteService.create', () => {
  it('locks lines, FX and validity, holding the stock it can until the quote expires', async () => {
    const { quotes, level, ledgerStore } = await setup()
    const result = await quotes.create(
      quoteInput([line('AMP', 2, 100_000n), line('SPK', 3, 50_000n)]),
    )
    expect(result).toMatchObject({
      ok: true,
      created: true,
      quote: {
        number: 'Q-AE-2026-000001',
        status: 'open',
        validUntil: new Date('2026-10-22T08:00:00Z'),
        fxLock: { at: clock, rates: { USD: '3.672500' } },
        lines: [
          { sku: 'AMP', held: true, unit: aed(100_000n), trace: [{ rule: 'contract' }] },
          { sku: 'SPK', held: false },
        ],
      },
    })
    expect([level('AMP', 'reserved'), level('SPK', 'reserved')]).toEqual([2, 0])
    expect(ledgerStore.reservations[0]).toMatchObject({
      docType: 'quote',
      docId: 'Q-AE-2026-000001',
      expiresAt: new Date('2026-10-22T08:00:00Z'),
    })
  })

  it('is idempotent, clamps validity, refuses viewers and unpriceable lines', async () => {
    const { quotes, store } = await setup()
    const input = quoteInput([line('AMP', 1, 100_000n)], {
      idempotencyKey: 'same',
      validityDays: 90,
    })
    const a = await quotes.create(input)
    const b = await quotes.create(input)
    expect(b).toMatchObject({ ok: true, created: false })
    expect(store.quotes).toHaveLength(1)
    expect(a.ok && a.quote.validUntil).toEqual(new Date('2026-11-14T08:00:00Z'))
    expect(
      await quotes.create(quoteInput([line('AMP', 1, 1n)], { creator: { id: 1, role: 'viewer' } })),
    ).toEqual({ ok: false, reason: 'not-allowed' })
    expect(
      await quotes.create(quoteInput([{ ...line('X', 1, 1n), status: 'unavailable' }])),
    ).toMatchObject({ ok: false, reason: 'lines', problems: { lines: [{ sku: 'X' }] } })
    const short = await quotes.create(quoteInput([line('AMP', 1, 1n)], { validityDays: 0 }))
    expect(short.ok && short.quote.validUntil).toEqual(new Date('2026-10-16T08:00:00Z'))
  })
})

describe('QuoteService.toOrder', () => {
  it('orders at the locked prices and moves the quote’s holds to the order, once', async () => {
    const { quotes, level, ledgerStore } = await setup()
    const created = await quotes.create(quoteInput([line('AMP', 2, 100_000n)]))
    const number = created.ok ? created.quote.number : ''
    const result = await quotes.toOrder(number, orderParties)
    expect(result).toMatchObject({
      ok: true,
      quote: { status: 'ordered', order: 'T-AE-2026-000001' },
      order: { status: 'confirmed', lines: [{ sku: 'AMP', unit: aed(100_000n) }] },
    })
    expect(level('AMP', 'reserved')).toBe(2)
    expect(ledgerStore.reservations).toHaveLength(1)
    expect(ledgerStore.reservations[0]).toMatchObject({
      status: 'active',
      docType: 'order',
      docId: 'T-AE-2026-000001',
      expiresAt: null,
    })
    expect(await quotes.toOrder(number, orderParties)).toEqual({ ok: false, reason: 'not-open' })
    expect(await quotes.toOrder('Q-NOPE', orderParties)).toEqual({ ok: false, reason: 'not-found' })
  })

  it('reserves afresh a line whose hold lapsed or that was never held', async () => {
    const { quotes, ledger, level } = await setup({ AMP: 5, SPK: 0 })
    const created = await quotes.create(quoteInput([line('AMP', 2, 100_000n), line('SPK', 1, 1n)]))
    const number = created.ok ? created.quote.number : ''
    await ledger.move({
      sku: 'SPK',
      qty: 3,
      from: null,
      to: 'available',
      location: DXB,
      doc: { type: 'opening', id: 'OB2' },
    })
    const id = created.ok ? created.quote.reservations[0] : null
    if (id) await ledger.release(id)
    expect(await quotes.toOrder(number, orderParties)).toMatchObject({
      ok: true,
      order: { status: 'confirmed' },
    })
    expect([level('AMP', 'reserved'), level('SPK', 'reserved')]).toEqual([2, 1])
  })

  it('keeps the quote open when the order is refused, and frees nothing it should keep', async () => {
    const { quotes, level } = await setup()
    const created = await quotes.create(quoteInput([line('AMP', 2, 100_000n)]))
    const number = created.ok ? created.quote.number : ''
    const refused = await quotes.toOrder(number, {
      ...orderParties,
      company: { ...orderParties.company, hold: true },
    })
    expect(refused).toMatchObject({
      ok: false,
      reason: 'order-refused',
      refusal: { reason: 'on-hold' },
    })
    expect(level('AMP', 'reserved')).toBe(2)
    const again = await quotes.toOrder(number, orderParties)
    expect(again).toMatchObject({ ok: true })
  })

  it('marks lines unheld when stock ran out at ordering', async () => {
    const { quotes, store, ledger } = await setup({ AMP: 2, SPK: 1 })
    const created = await quotes.create(quoteInput([line('AMP', 2, 1n), line('SPK', 2, 1n)]))
    const number = created.ok ? created.quote.number : ''
    await ledger.reserve({ sku: 'SPK', qty: 1, market: 'ae', doc: { type: 'cart', id: 'C' } })
    expect(await quotes.toOrder(number, orderParties)).toMatchObject({
      ok: false,
      refusal: { reason: 'unavailable', skus: ['SPK'] },
    })
    const quote = store.quotes[0]
    expect(quote?.status).toBe('open')
    expect(quote?.lines.map((l) => l.held)).toEqual([false, false])
  })

  it('expires a quote past its validity, releasing its holds', async () => {
    const { quotes, level } = await setup()
    const created = await quotes.create(quoteInput([line('AMP', 2, 100_000n)]))
    const number = created.ok ? created.quote.number : ''
    clock = new Date('2026-10-22T08:00:00Z')
    expect(await quotes.toOrder(number, orderParties)).toEqual({ ok: false, reason: 'expired' })
    expect(level('AMP', 'reserved')).toBe(0)
    expect(await quotes.toOrder(number, orderParties)).toEqual({ ok: false, reason: 'not-open' })
  })

  it('lets one of two racing orderers win', async () => {
    const { quotes, orderStore } = await setup()
    const created = await quotes.create(quoteInput([line('AMP', 1, 100_000n)]))
    const number = created.ok ? created.quote.number : ''
    const results = await Promise.all([
      quotes.toOrder(number, orderParties),
      quotes.toOrder(number, orderParties),
      quotes.withdraw(number),
    ])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    for (const r of results.filter((x) => !x.ok))
      expect(['busy', 'not-open']).toContain(!r.ok && r.reason)
    expect(orderStore.orders).toHaveLength(1)
  })
})

describe('QuoteService.withdraw', () => {
  it('releases the holds of an open quote, and only an open one', async () => {
    const { quotes, level } = await setup()
    const created = await quotes.create(quoteInput([line('AMP', 3, 100_000n)]))
    const number = created.ok ? created.quote.number : ''
    expect(await quotes.withdraw(number)).toMatchObject({
      ok: true,
      quote: { status: 'withdrawn' },
    })
    expect(level('AMP', 'reserved')).toBe(0)
    expect(await quotes.withdraw(number)).toEqual({ ok: false, reason: 'not-open' })
    expect(await quotes.withdraw('Q-NOPE')).toEqual({ ok: false, reason: 'not-found' })
  })
})
