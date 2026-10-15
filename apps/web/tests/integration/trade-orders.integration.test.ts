import { beforeAll, describe, expect, it, vi } from 'vitest'
import { sql } from '@payloadcms/db-postgres/drizzle'
import type { TypedUser } from 'payload'
import { decideTradeOrder, placeTradeOrder, previewTradeOrder, tradeCredit } from '@alpha/payload'
import { ORIGIN, form } from './helpers/commerce'
import { db, staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'
import { seedTrade, type TradeFixture } from './helpers/trade'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

/**
 * Task 0015: dealer orders over Postgres — placing, idempotency, the credit check under
 * concurrency, order rules, hold, approvals by owner and staff, cancel and reject, and company
 * isolation of orders.
 */
const payload = usePayload()
let t: TradeFixture
let purchaser: TypedUser
let gammaOwner: TypedUser
const PASSWORD = 'orders-password-123'

const as = async () => ({ user: await staff(payload()), overrideAccess: false }) as const
const reserved = async (sku: string) => {
  const { rows } = await db(payload()).execute(
    sql`SELECT COALESCE(SUM(qty), 0)::int AS n FROM stock_levels WHERE sku = ${sku} AND state = 'reserved'`,
  )
  return Number(rows[0]?.['n'] ?? 0)
}
let keys = 0
const place = (user: unknown, lines: Array<{ sku: string; qty: number }>, key?: string) =>
  placeTradeOrder(payload(), user, {
    lines,
    idempotencyKey: key ?? `key-${++keys}`,
    poNumber: 'PO-77',
    note: 'Deliver to the showroom',
    locale: 'en',
  })
const numberOf = (r: Awaited<ReturnType<typeof place>>) =>
  r && 'order' in r && r.order ? r.order.number : ''

async function signedIn(email: string, company: number, role: string, threshold?: number) {
  await payload().create({
    collection: 'company-users',
    data: {
      email,
      password: PASSWORD,
      company,
      role: role as 'owner',
      locale: 'en',
      ...(threshold !== undefined ? { approvalThreshold: threshold } : {}),
    },
    ...(await as()),
  })
  const { token } = await payload().login({
    collection: 'company-users',
    data: { email, password: PASSWORD },
  })
  const { user } = await payload().auth({
    headers: new Headers({ authorization: `JWT ${token}` }),
  })
  if (!user) throw new Error(`could not sign in ${email}`)
  return user
}

beforeAll(async () => {
  t = await seedTrade(payload(), 'to')
  purchaser = await signedIn('buyer@to-alpha.example', t.alpha.id, 'purchaser', 1_000_000)
  const gamma = await payload().create({
    collection: 'companies',
    data: {
      name: 'to Gamma Audio',
      market: 'ae',
      channel: 'dealer',
      creditLimit: 1_000_000,
      settings: { stockVisibility: 'banded' },
    },
    ...(await as()),
  })
  gammaOwner = await signedIn('owner@to-gamma.example', gamma.id, 'owner')
})

describe('placing a dealer order', () => {
  it('never lets parallel orders overspend the credit limit', async () => {
    // Speakers: dealer list 4,000.00 net, 4,200.00 gross; a 10,000.00 limit fits two.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => place(gammaOwner, [{ sku: t.skus.spk, qty: 1 }])),
    )
    const statuses = results.map((r) => (r?.ok ? r.order.status : r?.reason))
    expect(statuses.filter((s) => s === 'confirmed')).toHaveLength(2)
    expect(statuses.filter((s) => s === 'pending-approval')).toHaveLength(8)
    expect(await tradeCredit(payload(), gammaOwner)).toMatchObject({
      limit: { amount: 1_000_000n },
      used: { amount: 4_200_000n },
      available: { amount: 0n },
    })
    for (const r of results)
      if (r?.ok && r.order.status === 'pending-approval')
        await decideTradeOrder(payload(), gammaOwner, r.order.number, 'cancel')
    expect(await reserved(t.skus.spk)).toBe(2)
  })

  it('confirms an owner’s order within credit, holds its stock and is idempotent', async () => {
    const result = await place(t.alphaOwner, [{ sku: t.skus.amp, qty: 2 }], 'same-key')
    expect(result).toMatchObject({
      ok: true,
      created: true,
      order: {
        status: 'confirmed',
        approvals: [],
        totals: {
          net: { amount: 1_380_000n },
          vat: { amount: 69_000n },
          gross: { amount: 1_449_000n },
        },
        lines: [{ sku: t.skus.amp, qty: 2, basis: 'contract', unit: { amount: 690_000n } }],
      },
    })
    expect(numberOf(result)).toMatch(/^T-AE-2026-\d{6}$/)
    expect(await reserved(t.skus.amp)).toBe(2)
    const again = await place(t.alphaOwner, [{ sku: t.skus.amp, qty: 2 }], 'same-key')
    expect(again).toMatchObject({ ok: true, created: false, order: { number: numberOf(result) } })
    expect(await reserved(t.skus.amp)).toBe(2)
    // The key is the company's own: another company's identical key is another order.
    expect(await place(t.betaOwner, [{ sku: t.skus.amp, qty: 1 }], 'same-key')).toMatchObject({
      ok: true,
      created: true,
    })
    const stored = await payload().find({
      collection: 'trade-orders',
      where: { number: { equals: numberOf(result) } },
      ...(await as()),
    })
    expect(stored.docs[0]).toMatchObject({ poNumber: 'PO-77', note: 'Deliver to the showroom' })
    // The stored trace never carries the internal steps.
    expect(JSON.stringify(stored.docs[0]?.lines)).not.toContain('margin-floor')
  })

  it('refuses viewers, accounts on hold and broken order rules, reserving nothing', async () => {
    const before = await reserved(t.skus.amp)
    expect(await place(t.alphaViewer, [{ sku: t.skus.amp, qty: 1 }])).toEqual({
      ok: false,
      reason: 'not-allowed',
    })
    await payload().update({
      collection: 'companies',
      id: t.alpha.id,
      data: { hold: true },
      ...(await as()),
    })
    expect(await place(t.alphaOwner, [{ sku: t.skus.amp, qty: 1 }])).toEqual({
      ok: false,
      reason: 'on-hold',
    })
    await payload().update({
      collection: 'companies',
      id: t.alpha.id,
      data: { hold: false },
      ...(await as()),
    })
    await payload().update({
      collection: 'companies',
      id: t.beta.id,
      data: { settings: { stockVisibility: 'hidden', orderMultiple: 2, minOrderValue: 2_000_000 } },
      ...(await as()),
    })
    expect(
      await place(t.betaOwner, [
        { sku: t.skus.amp, qty: 1 },
        { sku: 'TO-NOPE', qty: 2 },
      ]),
    ).toMatchObject({
      ok: false,
      reason: 'rules',
      problems: {
        lines: [
          { sku: t.skus.amp, problem: 'multiple', multiple: 2 },
          { sku: 'TO-NOPE', problem: 'unavailable' },
        ],
        order: [{ problem: 'minimum-value', minimum: { amount: 2_000_000n } }],
      },
    })
    expect(await reserved(t.skus.amp)).toBe(before)
    expect(
      await placeTradeOrder(payload(), await staff(payload()), {
        lines: [{ sku: t.skus.amp, qty: 1 }],
        idempotencyKey: 'staff',
        locale: 'en',
      }),
    ).toBeNull()
  })

  it('previews lines, problems, approvals and credit without placing', async () => {
    const preview = await previewTradeOrder(
      payload(),
      purchaser,
      [
        { sku: t.skus.amp.toLowerCase(), qty: 1 },
        { sku: t.skus.amp, qty: 1 },
        { sku: ' ', qty: 3 },
      ],
      { locale: 'en' },
    )
    expect(preview).toMatchObject({
      lines: [{ sku: t.skus.amp, qty: 2 }],
      approvals: [{ kind: 'company', reason: 'threshold' }],
      canOrder: true,
      credit: { limit: { amount: 5_000_000n } },
    })
    expect(
      await previewTradeOrder(payload(), t.alphaViewer, [{ sku: t.skus.amp, qty: 1 }], {
        locale: 'en',
      }),
    ).toMatchObject({ canOrder: false, credit: null })
    expect(await tradeCredit(payload(), t.alphaViewer)).toBeNull()
  })
})

describe('approvals', () => {
  it('a purchaser above their threshold waits for an owner, who alone can approve', async () => {
    const placed = await place(purchaser, [{ sku: t.skus.amp, qty: 2 }])
    expect(placed).toMatchObject({
      ok: true,
      order: { status: 'pending-approval', approvals: [{ kind: 'company', reason: 'threshold' }] },
    })
    const number = numberOf(placed)
    expect(await decideTradeOrder(payload(), purchaser, number, 'approve')).toEqual({
      ok: false,
      reason: 'forbidden',
    })
    expect(await decideTradeOrder(payload(), t.betaOwner, number, 'approve')).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(await decideTradeOrder(payload(), await staff(payload()), number, 'approve')).toEqual({
      ok: false,
      reason: 'nothing-to-decide',
    })
    expect(
      await decideTradeOrder(payload(), t.alphaOwner, number, 'approve', 'Fine'),
    ).toMatchObject({
      ok: true,
      order: {
        status: 'confirmed',
        approvals: [{ status: 'approved', by: t.alphaOwner.id, note: 'Fine' }],
      },
    })
    const { rows } = await db(payload()).execute(
      sql`SELECT expires_at FROM reservations WHERE doc_id = ${number} AND status = 'active'`,
    )
    expect(rows.map((r) => r['expires_at'])).toEqual([null])
  })

  it('over the credit limit or below the floor, only staff can approve', async () => {
    // Used so far: 14,490.00 + 14,490.00; three more amplifiers (21,735.00) pass 50,000.00.
    const over = await place(t.alphaOwner, [{ sku: t.skus.amp, qty: 3 }])
    expect(over).toMatchObject({
      ok: true,
      order: { status: 'pending-approval', approvals: [{ kind: 'alpha', reason: 'credit' }] },
    })
    expect(await decideTradeOrder(payload(), t.alphaOwner, numberOf(over), 'approve')).toEqual({
      ok: false,
      reason: 'nothing-to-decide',
    })
    expect(
      await decideTradeOrder(payload(), await staff(payload()), numberOf(over), 'approve'),
    ).toMatchObject({ ok: true, order: { status: 'confirmed' } })

    await payload().create({
      collection: 'contract-prices',
      data: { company: t.beta.id, sku: t.skus.spk, price: 310_000 },
      ...(await as()),
    })
    await payload().update({
      collection: 'companies',
      id: t.beta.id,
      data: {
        creditLimit: 50_000_000,
        settings: { stockVisibility: 'hidden', orderMultiple: null, minOrderValue: null },
      },
      ...(await as()),
    })
    const cheap = await place(t.betaOwner, [{ sku: t.skus.spk, qty: 2 }])
    expect(cheap).toMatchObject({
      ok: true,
      order: {
        status: 'pending-approval',
        approvals: [{ kind: 'alpha', reason: 'price' }],
        lines: [{ status: 'needs-approval' }],
      },
    })
    expect(
      await decideTradeOrder(
        payload(),
        await staff(payload()),
        numberOf(cheap),
        'reject',
        'Below cost',
      ),
    ).toMatchObject({ ok: true, order: { status: 'rejected', closedReason: 'Below cost' } })
    expect(
      await decideTradeOrder(payload(), await staff(payload()), numberOf(cheap), 'cancel'),
    ).toEqual({
      ok: false,
      reason: 'forbidden',
    })
  })

  it('cancelling or rejecting releases the stock; confirmed orders cannot be cancelled', async () => {
    const before = await reserved(t.skus.amp)
    const a = await place(purchaser, [{ sku: t.skus.amp, qty: 2 }])
    expect(await reserved(t.skus.amp)).toBe(before + 2)
    expect(await decideTradeOrder(payload(), t.alphaViewer, numberOf(a), 'cancel')).toEqual({
      ok: false,
      reason: 'forbidden',
    })
    expect(
      await decideTradeOrder(payload(), purchaser, numberOf(a), 'cancel', 'Typo'),
    ).toMatchObject({
      ok: true,
      order: { status: 'cancelled', closedReason: 'Typo' },
    })
    const b = await place(purchaser, [{ sku: t.skus.amp, qty: 2 }])
    await decideTradeOrder(payload(), t.alphaOwner, numberOf(b), 'reject', 'Not now')
    expect(await reserved(t.skus.amp)).toBe(before)
    const confirmed = await place(t.betaOwner, [{ sku: t.skus.amp, qty: 1 }])
    expect(confirmed).toMatchObject({ ok: true, order: { status: 'confirmed' } })
    expect(await decideTradeOrder(payload(), t.betaOwner, numberOf(confirmed), 'cancel')).toEqual({
      ok: false,
      reason: 'not-pending',
    })
  })
})

describe('the ops approval endpoint', () => {
  it('lets staff decide by form, and refuses anyone else', async () => {
    const ops = await import('@/lib/api/opsTradeOrders')
    await payload().update({
      collection: 'companies',
      id: t.beta.id,
      data: { creditLimit: 0 },
      ...(await as()),
    })
    const placed = await place(t.betaOwner, [{ sku: t.skus.amp, qty: 1 }])
    const number = numberOf(placed)
    const { token } = await payload().login({
      collection: 'users',
      data: { email: (await staff(payload())).email, password: 'integration-password-1' },
    })
    const post = (headers: Record<string, string>, fields: Record<string, string>) =>
      ops.postTradeOrderAction(
        { payload: payload() },
        form(`/api/v1/ops/trade-orders/${number}/decide`, fields, headers),
        number,
        'decide',
      )
    const res = await post(
      { origin: ORIGIN, authorization: `JWT ${token}` },
      { decision: 'approve', reason: 'Credit raised by phone' },
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      `/ops/trade-orders/?result=approved&order=${encodeURIComponent(number)}`,
    )
    const cross = await post(
      { origin: 'https://evil.example', authorization: `JWT ${token}` },
      { decision: 'reject' },
    )
    expect(cross.status).toBe(403)
    const anonymous = await ops.postTradeOrderAction(
      { payload: payload() },
      new Request(`${ORIGIN}/api/v1/ops/trade-orders/${number}/approve`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json' },
        body: '{}',
      }),
      number,
      'approve',
    )
    expect(anonymous.status).toBe(401)
    expect(
      (
        await ops.postTradeOrderAction(
          { payload: payload() },
          form(
            `/api/v1/ops/trade-orders/${number}/constructor`,
            {},
            {
              origin: ORIGIN,
              authorization: `JWT ${token}`,
            },
          ),
          number,
          'constructor',
        )
      ).status,
    ).toBe(404)
  })
})

describe('who reads dealer orders', () => {
  it('a company reads only its own orders, without reservations or keys; anonymous nothing', async () => {
    const read = async (user: unknown) =>
      payload().find({
        collection: 'trade-orders',
        user: user as TypedUser,
        overrideAccess: false,
        limit: 100,
      })
    const alpha = await read(t.alphaViewer)
    const beta = await read(t.betaOwner)
    expect(alpha.totalDocs).toBeGreaterThan(0)
    expect(
      alpha.docs.every(
        (o) => (typeof o.company === 'object' ? o.company.id : o.company) === t.alpha.id,
      ),
    ).toBe(true)
    expect(
      beta.docs.every(
        (o) => (typeof o.company === 'object' ? o.company.id : o.company) === t.beta.id,
      ),
    ).toBe(true)
    expect(alpha.docs[0]?.reservations).toBeUndefined()
    expect(alpha.docs[0]?.idempotencyKey).toBeUndefined()
    expect(alpha.docs[0]?.staffNotes).toBeUndefined()
    await expect(
      payload().find({ collection: 'trade-orders', overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload().update({
        collection: 'trade-orders',
        id: alpha.docs[0]?.id as number,
        data: { staffNotes: 'x' },
        user: t.alphaOwner,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
  })
})
