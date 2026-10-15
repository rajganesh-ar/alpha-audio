import { describe, expect, it } from 'vitest'
import { LedgerService } from '../ledger/LedgerService'
import { MemoryLedgerStore } from '../ledger/memoryStore'
import { levelId, type StockState } from '../ledger/types'
import { checkInvariants } from '../ledger/invariants'
import { money } from '../money'
import type { PaymentEvent, PaymentProvider, PaymentRequest } from '../payments/types'
import { CheckoutService, type StartInput } from './CheckoutService'
import { MemoryCheckoutStore } from './memoryStore'
import { priceBag, type CatalogEntry } from './pricing'

const ae = { code: 'ae', currency: 'AED', decimals: 2, vatRate: 5 } as const
const DXB = 1
const entry = (sku: string, amount: number): CatalogEntry => ({
  sku,
  productId: sku,
  title: sku,
  price: { kind: 'priced', price: money(amount, 'AED', 2), vat: money(0, 'AED', 2), vatRate: 5 },
  onSale: true,
})
const CATALOG: Record<string, CatalogEntry> = { A: entry('A', 3_450_000), B: entry('B', 239_900) }

class TestProvider implements PaymentProvider {
  readonly id = 'test'
  readonly methods = ['card']
  requests: PaymentRequest[] = []
  fail = false
  async createPayment(request: PaymentRequest) {
    this.requests.push(request)
    if (this.fail) throw new Error('gateway down')
    return {
      provider: this.id,
      intentId: `pi_${request.idempotencyKey}`,
      redirectUrl: `https://pay.example/${request.idempotencyKey}`,
    }
  }
  parseWebhook() {
    return null
  }
}

function setup() {
  let now = new Date('2026-10-15T08:00:00Z')
  const ledgerStore = new MemoryLedgerStore([{ id: DXB, market: 'ae', sellable: true }])
  const ledger = new LedgerService(ledgerStore, () => now)
  const store = new MemoryCheckoutStore()
  const provider = new TestProvider()
  const checkout = new CheckoutService(store, ledger, provider, () => now)
  const stock = async (sku: string, qty: number) =>
    ledger.move({
      sku,
      qty,
      from: null,
      to: 'available',
      location: DXB,
      doc: { type: 'opening', id: 'OB' },
    })
  const level = (sku: string, state: StockState) =>
    ledgerStore.levels.find((l) => levelId(l) === levelId({ sku, location: DXB, state }))?.qty ?? 0
  const input = (items: Array<{ sku: string; qty: number }>, key = 'key-1'): StartInput => ({
    market: 'ae',
    bag: priceBag(items, (s) => CATALOG[s], ae),
    idempotencyKey: key,
    method: 'card',
    locale: 'en',
    returnUrl: (n) => `/ae/en/checkout/return/?order=${n}`,
    details: { contact: { email: 'a@example.com' } },
  })
  const event = (
    intentId: string,
    type: PaymentEvent['type'],
    amount: bigint,
    eventId = `evt_${Math.random()}`,
  ): PaymentEvent => ({
    provider: 'test',
    eventId,
    intentId,
    type,
    amount,
    currency: 'AED',
  })
  return {
    ledger,
    ledgerStore,
    store,
    provider,
    checkout,
    stock,
    level,
    input,
    event,
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
  }
}

describe('start', () => {
  it('holds every line for 15 minutes and opens one payment', async () => {
    const { checkout, stock, level, input, provider } = setup()
    await stock('A', 3)
    await stock('B', 1)
    const r = await checkout.start(
      input([
        { sku: 'A', qty: 2 },
        { sku: 'B', qty: 1 },
      ]),
    )
    if (!r.ok) throw new Error(r.reason)
    expect(r.order).toMatchObject({
      number: 'AE-2026-000001',
      status: 'paying',
      holdExpiresAt: new Date('2026-10-15T08:15:00Z'),
    })
    expect(r.order.reservations).toHaveLength(2)
    expect(r.redirectUrl).toBe('https://pay.example/key-1')
    expect([level('A', 'reserved'), level('A', 'available'), level('B', 'reserved')]).toEqual([
      2, 1, 1,
    ])
    expect(provider.requests[0]).toMatchObject({
      orderNumber: 'AE-2026-000001',
      amount: money(7_139_900, 'AED', 2),
      returnUrl: '/ae/en/checkout/return/?order=AE-2026-000001',
    })
  })

  it('is idempotent on the key: a resubmit returns the same order and payment, and holds nothing more', async () => {
    const { checkout, stock, level, input, store } = setup()
    await stock('A', 5)
    const first = await checkout.start(input([{ sku: 'A', qty: 2 }]))
    const again = await checkout.start(input([{ sku: 'A', qty: 2 }]))
    const parallel = await Promise.all([
      checkout.start(input([{ sku: 'A', qty: 1 }], 'k2')),
      checkout.start(input([{ sku: 'A', qty: 1 }], 'k2')),
    ])
    if (!first.ok || !again.ok) throw new Error('expected ok')
    expect(again.order.number).toBe(first.order.number)
    expect(again.redirectUrl).toBe(first.redirectUrl)
    expect(new Set(parallel.map((p) => p.order?.number)).size).toBe(1)
    expect(parallel.map((p) => (p.ok ? 'ok' : p.reason)).sort()).toEqual(['in-progress', 'ok'])
    expect(store.orders.size).toBe(2)
    expect(level('A', 'reserved')).toBe(3)
  })

  it('holds all lines or none, naming the line that failed', async () => {
    const { checkout, stock, level, input, ledgerStore } = setup()
    await stock('A', 3)
    const r = await checkout.start(
      input([
        { sku: 'A', qty: 2 },
        { sku: 'B', qty: 1 },
      ]),
    )
    expect(r).toMatchObject({ ok: false, reason: 'unavailable', skus: ['B'] })
    expect([level('A', 'reserved'), level('A', 'available')]).toEqual([0, 3])
    expect(r.order?.status).toBe('unavailable')
    expect(
      await checkout.start(
        input([
          { sku: 'A', qty: 2 },
          { sku: 'B', qty: 1 },
        ]),
      ),
    ).toMatchObject({ reason: 'unavailable', skus: ['B'] })
    expect(checkInvariants(ledgerStore)).toEqual([])
  })

  it('refuses an invalid bag and releases holds when the payment cannot be created', async () => {
    const { checkout, stock, level, input, provider } = setup()
    expect(await checkout.start(input([]))).toEqual({ ok: false, reason: 'bag-invalid' })
    expect(await checkout.start(input([{ sku: 'X', qty: 1 }]))).toEqual({
      ok: false,
      reason: 'bag-invalid',
    })
    await stock('A', 1)
    provider.fail = true
    const r = await checkout.start(input([{ sku: 'A', qty: 1 }], 'k9'))
    expect(r).toMatchObject({ ok: false, reason: 'payment-error' })
    expect(level('A', 'reserved')).toBe(0)
    expect(await checkout.start(input([{ sku: 'A', qty: 1 }], 'k9'))).toMatchObject({
      ok: false,
      reason: 'already-closed',
    })
  })
})

describe('payment events', () => {
  const ready = async () => {
    const t = setup()
    await t.stock('A', 3)
    const r = await t.checkout.start(t.input([{ sku: 'A', qty: 2 }]))
    if (!r.ok) throw new Error(r.reason)
    return { ...t, order: r.order, intent: r.order.payment.intentId as string }
  }

  it('confirms on capture: cart holds become order holds with no expiry; replays change nothing', async () => {
    const { checkout, event, intent, level, ledger, advance, store, order } = await ready()
    const captured = event(intent, 'captured', 6_900_000n, 'evt_1')
    expect((await checkout.handlePaymentEvent(captured, 'h')).outcome).toBe('confirmed')
    expect((await checkout.handlePaymentEvent(captured, 'h')).outcome).toBe('duplicate')
    expect(
      (await checkout.handlePaymentEvent(event(intent, 'authorised', 6_900_000n), 'h')).outcome,
    ).toBe('already-confirmed')
    const saved = store.orders.get(String(order.id))
    expect(saved).toMatchObject({
      status: 'confirmed',
      holdExpiresAt: null,
      payment: { status: 'captured' },
    })
    advance(60 * 60 * 1000)
    expect(await ledger.releaseExpiredReservations()).toBe(0)
    expect(level('A', 'reserved')).toBe(2)
  })

  it('confirms once under concurrent events', async () => {
    const { checkout, event, intent, level } = await ready()
    const outcomes = await Promise.all([
      checkout.handlePaymentEvent(event(intent, 'captured', 6_900_000n), 'h'),
      checkout.handlePaymentEvent(event(intent, 'authorised', 6_900_000n), 'h'),
    ])
    // The loser of the compare-and-set does nothing.
    expect(outcomes.map((o) => o.outcome).sort()).toEqual(['confirmed', 'ignored'])
    expect(level('A', 'reserved')).toBe(2)
  })

  it('releases stock on decline, and refuses an amount or currency mismatch', async () => {
    const a = await ready()
    expect(
      (await a.checkout.handlePaymentEvent(a.event(a.intent, 'declined', 0n), 'h')).outcome,
    ).toBe('failed')
    expect([a.level('A', 'reserved'), a.level('A', 'available')]).toEqual([0, 3])
    expect(
      (await a.checkout.handlePaymentEvent(a.event(a.intent, 'captured', 6_900_000n), 'h')).outcome,
    ).toBe('ignored')

    const b = await ready()
    expect(
      (await b.checkout.handlePaymentEvent(b.event(b.intent, 'captured', 1n), 'h')).outcome,
    ).toBe('mismatch')
    expect(b.store.orders.get(String(b.order.id))).toMatchObject({
      status: 'failed',
      failureReason: 'amount-mismatch',
    })
    expect(b.level('A', 'reserved')).toBe(0)
    const c = await ready()
    expect(
      (
        await c.checkout.handlePaymentEvent(
          { ...c.event(c.intent, 'captured', 6_900_000n), currency: 'SAR' },
          'h',
        )
      ).outcome,
    ).toBe('mismatch')
    expect(
      (await c.checkout.handlePaymentEvent(c.event('pi_unknown', 'captured', 1n), 'h')).outcome,
    ).toBe('unknown-intent')
  })
})

describe('expiry and late payments', () => {
  it('expires paying orders after their holds lapse', async () => {
    const { checkout, stock, input, ledger, advance, store, level } = setup()
    await stock('A', 2)
    const r = await checkout.start(input([{ sku: 'A', qty: 2 }]))
    if (!r.ok) throw new Error(r.reason)
    advance(14 * 60 * 1000)
    expect(await checkout.expire()).toBe(0)
    advance(2 * 60 * 1000)
    expect(await ledger.releaseExpiredReservations()).toBe(1)
    expect(await checkout.expire()).toBe(1)
    expect(store.orders.get(String(r.order.id))?.status).toBe('expired')
    expect(level('A', 'available')).toBe(2)
  })

  it('re-holds stock for a late capture when it can, else fails the order for refund', async () => {
    const t = setup()
    await t.stock('A', 2)
    const r = await t.checkout.start(t.input([{ sku: 'A', qty: 2 }]))
    if (!r.ok) throw new Error(r.reason)
    t.advance(16 * 60 * 1000)
    await t.checkout.expire() // releases the lapsed holds itself, before the ledger job runs
    expect(
      (
        await t.checkout.handlePaymentEvent(
          t.event(r.order.payment.intentId as string, 'captured', 6_900_000n),
          'h',
        )
      ).outcome,
    ).toBe('confirmed')
    expect(t.level('A', 'reserved')).toBe(2)

    const u = setup()
    await u.stock('A', 2)
    const s = await u.checkout.start(u.input([{ sku: 'A', qty: 2 }]))
    if (!s.ok) throw new Error(s.reason)
    u.advance(16 * 60 * 1000)
    await u.ledger.releaseExpiredReservations()
    await u.ledger.reserve({ sku: 'A', qty: 1, market: 'ae', doc: { type: 'quote', id: 'Q1' } })
    expect(
      (
        await u.checkout.handlePaymentEvent(
          u.event(s.order.payment.intentId as string, 'captured', 6_900_000n),
          'h',
        )
      ).outcome,
    ).toBe('stock-lost')
    expect(u.store.orders.get(String(s.order.id))).toMatchObject({
      status: 'failed',
      failureReason: 'stock-lost',
    })
    expect([u.level('A', 'reserved'), u.level('A', 'available')]).toEqual([1, 1])
    expect(checkInvariants(u.ledgerStore)).toEqual([])
  })
})
