import { beforeAll, describe, expect, it, vi } from 'vitest'
import { sql } from '@payloadcms/db-postgres/drizzle'
import type { TypedUser } from 'payload'
import { createQuoteFromDraft, orderQuote, withdrawQuote } from '@alpha/payload'
import { db, staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'
import { seedTrade, type TradeFixture } from './helpers/trade'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

/**
 * Task 0016: dealer quotes over Postgres — locked prices and FX, stock holds for the validity,
 * quote to order with holds carried over, expiry, hold, and company isolation.
 */
const payload = usePayload()
let t: TradeFixture

const as = async () => ({ user: await staff(payload()), overrideAccess: false }) as const
let keys = 0
const quote = (user: unknown, lines: Array<{ sku: string; qty: number }>, now?: () => Date) =>
  createQuoteFromDraft(
    payload(),
    user,
    { lines, idempotencyKey: `quote-${++keys}`, reference: 'Villa 12', locale: 'en' },
    now,
  )
const numberOf = (r: Awaited<ReturnType<typeof quote>>) => (r?.ok ? r.quote.number : '')
const holds = async (doc: string) =>
  (
    await db(payload()).execute(
      sql`SELECT doc_type, qty, expires_at FROM reservations WHERE doc_id = ${doc} AND status = 'active'`,
    )
  ).rows

beforeAll(async () => {
  t = await seedTrade(payload(), 'qu')
  await payload().updateGlobal({
    slug: 'pricing-settings',
    data: {
      channelFactors: { dealer: 7_000, integrator: 7_500, retailer: 8_000 },
      fxRates: [{ currency: 'SAR', aedPerUnit: '0.979' }],
    },
    ...(await as()),
  })
})

describe('dealer quotes', () => {
  it('locks prices and FX for the validity and holds stock until it ends', async () => {
    const result = await quote(t.alphaOwner, [
      { sku: t.skus.amp, qty: 2 },
      { sku: t.skus.spk, qty: 1 },
    ])
    expect(result).toMatchObject({
      ok: true,
      created: true,
      quote: {
        status: 'open',
        lines: [
          { sku: t.skus.amp, held: true, basis: 'contract', unit: { amount: 690_000n } },
          { sku: t.skus.spk, held: true },
        ],
        fxLock: { rates: { SAR: '0.979000' } },
      },
    })
    const number = numberOf(result)
    expect(number).toMatch(/^Q-AE-2026-\d{6}$/)
    const validUntil = result?.ok ? result.quote.validUntil.getTime() : 0
    expect(validUntil - Date.now()).toBeGreaterThan(6.9 * 24 * 3600_000)
    const held = await holds(number)
    expect(held.map((h) => [h['doc_type'], Number(h['qty'])])).toEqual([
      ['quote', 2],
      ['quote', 1],
    ])
    const stored = await payload().find({
      collection: 'quotes',
      where: { number: { equals: number } },
      ...(await as()),
    })
    expect(stored.docs[0]).toMatchObject({ reference: 'Villa 12', vatRate: 5 })
  })

  it('orders at the locked prices after a price change, carrying the holds over, once', async () => {
    const created = await quote(t.alphaOwner, [{ sku: t.skus.amp, qty: 1 }])
    const number = numberOf(created)
    await payload().update({
      collection: 'contract-prices',
      where: { sku: { equals: t.skus.amp } },
      data: { price: 600_000 },
      ...(await as()),
    })
    const ordered = await orderQuote(payload(), t.alphaOwner, number)
    expect(ordered).toMatchObject({
      ok: true,
      quote: { status: 'ordered' },
      order: { status: 'confirmed', lines: [{ unit: { amount: 690_000n } }] },
    })
    const order = ordered.ok ? ordered.order.number : ''
    expect(await holds(number)).toEqual([])
    expect((await holds(order)).map((h) => [h['doc_type'], h['expires_at']])).toEqual([
      ['order', null],
    ])
    const stored = await payload().find({
      collection: 'trade-orders',
      where: { number: { equals: order } },
      ...(await as()),
    })
    expect(stored.docs[0]?.poNumber).toBe('Villa 12')
    expect(await orderQuote(payload(), t.alphaOwner, number)).toEqual({
      ok: false,
      reason: 'not-open',
    })
  })

  it('refuses an expired quote and releases what it held', async () => {
    const eightDaysAgo = () => new Date(Date.now() - 8 * 24 * 3600_000)
    const old = await quote(t.alphaOwner, [{ sku: t.skus.spk, qty: 1 }], eightDaysAgo)
    const number = numberOf(old)
    expect(await orderQuote(payload(), t.alphaOwner, number)).toEqual({
      ok: false,
      reason: 'expired',
    })
    expect(await holds(number)).toEqual([])
  })

  it('quotes on hold, but the order waits until the hold is lifted', async () => {
    await payload().update({
      collection: 'companies',
      id: t.alpha.id,
      data: { hold: true },
      ...(await as()),
    })
    const created = await quote(t.alphaOwner, [{ sku: t.skus.spk, qty: 1 }])
    expect(created).toMatchObject({ ok: true })
    const number = numberOf(created)
    expect(await orderQuote(payload(), t.alphaOwner, number)).toMatchObject({
      ok: false,
      reason: 'order-refused',
      refusal: { reason: 'on-hold' },
    })
    await payload().update({
      collection: 'companies',
      id: t.alpha.id,
      data: { hold: false },
      ...(await as()),
    })
    expect(await orderQuote(payload(), t.alphaOwner, number)).toMatchObject({ ok: true })
  })

  it('keeps quotes within the company; viewers cannot quote or withdraw', async () => {
    const created = await quote(t.alphaOwner, [{ sku: t.skus.amp, qty: 1 }])
    const number = numberOf(created)
    expect(await quote(t.alphaViewer, [{ sku: t.skus.amp, qty: 1 }])).toEqual({
      ok: false,
      reason: 'not-allowed',
    })
    expect(await orderQuote(payload(), t.betaOwner, number)).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(await withdrawQuote(payload(), t.betaOwner, number)).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(await withdrawQuote(payload(), t.alphaViewer, number)).toEqual({
      ok: false,
      reason: 'forbidden',
    })
    const read = async (user: TypedUser) =>
      payload().find({ collection: 'quotes', user, overrideAccess: false, limit: 100 })
    const beta = await read(t.betaOwner)
    expect(beta.docs.map((q) => q.number)).not.toContain(number)
    const alpha = await read(t.alphaViewer)
    expect(alpha.docs.map((q) => q.number)).toContain(number)
    expect(alpha.docs[0]?.reservations).toBeUndefined()
    expect(alpha.docs[0]?.fxRates).toBeUndefined()
    expect(await withdrawQuote(payload(), t.alphaOwner, number)).toMatchObject({
      ok: true,
      quote: { status: 'withdrawn' },
    })
    expect(await holds(number)).toEqual([])
    expect(
      await createQuoteFromDraft(payload(), await staff(payload()), {
        lines: [{ sku: t.skus.amp, qty: 1 }],
        idempotencyKey: 'staff-quote',
        locale: 'en',
      }),
    ).toBeNull()
  })
})
