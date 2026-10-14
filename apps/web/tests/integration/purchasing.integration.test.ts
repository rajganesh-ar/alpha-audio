import { describe, expect, it } from 'vitest'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { ReceivingError } from '@alpha/core'
import { checkInvariants } from '@alpha/core/testing'
import { canReadCost, createLedger, createReceiving, PurchaseOrders } from '@alpha/payload'
import { postReceipt, putawayReceipt } from '@/lib/api/receipts'
import { db, ledgerSnapshot, staff } from './helpers/ledger'
import { draftReceipt, seedPurchasing } from './helpers/purchasing'
import { usePayload } from './helpers/suite'

const payload = usePayload()

async function refusal(
  action: Promise<unknown>,
): Promise<Error & { code?: string; status?: number; detail?: { serial?: string } }> {
  try {
    await action
  } catch (error) {
    return error as Error & { code?: string }
  }
  throw new Error('expected the operation to be refused')
}

const rows = async (query: ReturnType<typeof sql>) => (await db(payload()).execute(query)).rows

const receiptMovements = (number: string) =>
  rows(
    sql`SELECT sku, serial, qty, from_state::text AS from_state, to_state::text AS to_state FROM stock_movements WHERE doc_type = 'receipt' AND doc_id = ${number} ORDER BY id`,
  )

async function poLines(id: number) {
  const user = await staff(payload())
  const po = await payload().findByID({
    collection: 'purchase-orders',
    id,
    user,
    overrideAccess: false,
  })
  return {
    status: po.status,
    lines: (po.lines ?? []).map((l) => ({
      sku: l.sku,
      ordered: l.qtyOrdered,
      received: l.qtyReceived ?? 0,
      outstanding: l.qtyOrdered - (l.qtyReceived ?? 0),
    })),
  }
}

describe('posting a goods receipt', () => {
  it('writes one receipt movement per bulk line and one per serial; the invariants hold', async () => {
    const f = await seedPurchasing(payload())
    const r = await draftReceipt(payload(), f, [
      { poLine: f.bulk, sku: 'MA352', qty: 4 },
      { poLine: f.serialised, sku: 'MC462', qty: 2, serials: ['GR1-SN-1', 'GR1-SN-2'] },
    ])
    const user = await staff(payload())
    const result = await createReceiving(payload()).postReceipt(r.id, { user: user.id })
    expect(result).toEqual({
      booked: 6,
      quarantined: 0,
      unbooked: 0,
      poStatus: 'partially_received',
    })

    expect(await receiptMovements(r.number)).toEqual([
      { sku: 'MA352', serial: null, qty: '4', from_state: null, to_state: 'received' },
      { sku: 'MC462', serial: 'GR1-SN-1', qty: '1', from_state: null, to_state: 'received' },
      { sku: 'MC462', serial: 'GR1-SN-2', qty: '1', from_state: null, to_state: 'received' },
    ])
    const posted = await payload().findByID({
      collection: 'goods-receipts',
      id: r.id,
      user,
      overrideAccess: false,
    })
    expect(posted).toMatchObject({
      status: 'posted',
      postedBy: expect.objectContaining({ id: user.id }),
    })
    expect(posted.postedAt).toBeTruthy()
    expect(checkInvariants(await ledgerSnapshot(payload()))).toEqual([])
  })

  it('posts once: a second post, sequential or ten in parallel, is refused and writes nothing', async () => {
    const f = await seedPurchasing(payload())
    const receiving = createReceiving(payload())
    const sequential = await draftReceipt(payload(), f, [{ poLine: f.bulk, sku: 'MA352', qty: 2 }])
    await receiving.postReceipt(sequential.id)
    expect((await refusal(receiving.postReceipt(sequential.id))).code).toBe(
      'receipt-already-posted',
    )

    const parallel = await draftReceipt(payload(), f, [
      { poLine: f.bulk, sku: 'MA352', qty: 3 },
      { poLine: f.serialised, sku: 'MC462', qty: 1, serials: ['PAR-SN-1'] },
    ])
    const outcomes = await Promise.allSettled(
      Array.from({ length: 10 }, () => createReceiving(payload()).postReceipt(parallel.id)),
    )
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1)
    const refused = outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected')
    expect(refused).toHaveLength(9)
    for (const o of refused)
      expect((o.reason as ReceivingError).code).toBe('receipt-already-posted')

    expect(await receiptMovements(parallel.number)).toHaveLength(2)
    expect((await poLines(f.po.id)).lines[0]).toMatchObject({ received: 5, outstanding: 5 })
    expect(checkInvariants(await ledgerSnapshot(payload()))).toEqual([])
  })

  it('two different receipts against one PO in parallel both count', async () => {
    const f = await seedPurchasing(payload())
    const a = await draftReceipt(payload(), f, [{ poLine: f.bulk, sku: 'MA352', qty: 4 }])
    const b = await draftReceipt(payload(), f, [{ poLine: f.bulk, sku: 'MA352', qty: 6 }])
    await Promise.all([
      createReceiving(payload()).postReceipt(a.id),
      createReceiving(payload()).postReceipt(b.id),
    ])
    expect(await poLines(f.po.id)).toMatchObject({
      status: 'partially_received',
      lines: [
        { received: 10, outstanding: 0 },
        { received: 0, outstanding: 3 },
      ],
    })
  })

  it.each([
    ['a missing serial', ['MS-1'], 3, 'serial-missing', undefined],
    ['a serial scanned twice', ['DUP-1', 'DUP-1'], 2, 'serial-duplicate', 'DUP-1'],
  ] as const)(
    'refuses %s on a serialised line and rolls everything back',
    async (_case, serials, qty, code, serial) => {
      const f = await seedPurchasing(payload())
      const r = await draftReceipt(payload(), f, [
        { poLine: f.bulk, sku: 'MA352', qty: 1 },
        { poLine: f.serialised, sku: 'MC462', qty, serials: [...serials] },
      ])
      const error = await refusal(createReceiving(payload()).postReceipt(r.id))
      expect(error).toBeInstanceOf(ReceivingError)
      expect(error.code).toBe(code)
      if (serial) {
        expect(error.message).toContain(serial)
        expect(error.detail?.serial).toBe(serial)
      }
      expect(await receiptMovements(r.number)).toEqual([])
      expect(await poLines(f.po.id)).toMatchObject({
        status: 'ordered',
        lines: [{ received: 0 }, { received: 0 }],
      })
      const user = await staff(payload())
      expect(
        (
          await payload().findByID({
            collection: 'goods-receipts',
            id: r.id,
            user,
            overrideAccess: false,
          })
        ).status,
      ).toBe('draft')
    },
  )

  it('refuses a serial already in the ledger and names it', async () => {
    const f = await seedPurchasing(payload())
    await createLedger(payload()).move({
      sku: 'MC462',
      serial: 'LEDGER-SN-9',
      qty: 1,
      from: null,
      to: 'available',
      location: f.main,
      doc: { type: 'opening', id: 'OB-T' },
    })
    const r = await draftReceipt(payload(), f, [
      { poLine: f.serialised, sku: 'MC462', qty: 1, serials: ['LEDGER-SN-9'] },
    ])
    const error = await refusal(createReceiving(payload()).postReceipt(r.id))
    expect(error.code).toBe('serial-duplicate')
    expect(error.message).toContain('LEDGER-SN-9')
    expect(await receiptMovements(r.number)).toEqual([])
  })

  it('moves the PO to partially_received, then received, with the outstanding quantity per line', async () => {
    const f = await seedPurchasing(payload())
    const receiving = createReceiving(payload())
    const first = await draftReceipt(payload(), f, [{ poLine: f.bulk, sku: 'MA352', qty: 6 }])
    await receiving.postReceipt(first.id)
    expect(await poLines(f.po.id)).toEqual({
      status: 'partially_received',
      lines: [
        { sku: 'MA352', ordered: 10, received: 6, outstanding: 4 },
        { sku: 'MC462', ordered: 3, received: 0, outstanding: 3 },
      ],
    })
    const last = await draftReceipt(payload(), f, [
      { poLine: f.bulk, sku: 'MA352', qty: 4 },
      { poLine: f.serialised, sku: 'MC462', qty: 3, serials: ['LAST-1', 'LAST-2', 'LAST-3'] },
    ])
    expect((await receiving.postReceipt(last.id)).poStatus).toBe('received')
    expect(await poLines(f.po.id)).toEqual({
      status: 'received',
      lines: [
        { sku: 'MA352', ordered: 10, received: 10, outstanding: 0 },
        { sku: 'MC462', ordered: 3, received: 3, outstanding: 0 },
      ],
    })
    const over = await draftReceipt(payload(), f, [{ poLine: f.bulk, sku: 'MA352', qty: 1 }])
    expect((await refusal(receiving.postReceipt(over.id))).code).toBe('po-not-open')
  })

  it('needs an over exception to receive beyond the line', async () => {
    const f = await seedPurchasing(payload())
    const receiving = createReceiving(payload())
    const r = await draftReceipt(payload(), f, [{ poLine: f.bulk, sku: 'MA352', qty: 11 }])
    expect((await refusal(receiving.postReceipt(r.id))).code).toBe('over-receipt')
    const accepted = await draftReceipt(payload(), f, [
      {
        poLine: f.bulk,
        sku: 'MA352',
        qty: 11,
        exceptions: [{ type: 'over', qty: 1, note: 'Supplier sent a spare' }],
      },
    ])
    await receiving.postReceipt(accepted.id)
    expect((await poLines(f.po.id)).lines[0]).toMatchObject({ received: 11, outstanding: -1 })
  })

  it.each(['cancelled', 'closed'] as const)('refuses a %s purchase order', async (status) => {
    const f = await seedPurchasing(payload())
    const user = await staff(payload())
    await payload().update({
      collection: 'purchase-orders',
      id: f.po.id,
      data: { status },
      user,
      overrideAccess: false,
    })
    const r = await draftReceipt(payload(), f, [{ poLine: f.bulk, sku: 'MA352', qty: 1 }])
    expect((await refusal(createReceiving(payload()).postReceipt(r.id))).code).toBe('po-not-open')
    expect(await receiptMovements(r.number)).toEqual([])
  })
})

describe('damaged units and put-away', () => {
  it('ends damaged units in quarantine, puts the rest away, and keeps the exception on the receipt', async () => {
    const f = await seedPurchasing(payload())
    const r = await draftReceipt(payload(), f, [
      {
        poLine: f.bulk,
        sku: 'MA352',
        qty: 5,
        exceptions: [{ type: 'damaged', qty: 2, note: 'Crushed cartons' }],
      },
      {
        poLine: f.serialised,
        sku: 'MC462',
        qty: 2,
        serials: ['DMG-1', 'DMG-2'],
        exceptions: [{ type: 'damaged', serials: ['DMG-2'], note: 'Dented faceplate' }],
      },
    ])
    const receiving = createReceiving(payload())
    expect(await receiving.postReceipt(r.id)).toMatchObject({ booked: 7, quarantined: 3 })
    expect(await receiving.putaway(r.id, { location: f.main })).toEqual({ available: 4 })

    const level = async (sku: string, location: number, state: string) =>
      Number(
        (
          await rows(
            sql`SELECT qty FROM stock_levels WHERE sku = ${sku} AND location_id = ${location} AND state = ${state}`,
          )
        )[0]?.['qty'] ?? 0,
      )
    expect(await level('MA352', f.dock, 'quarantine')).toBe(2)
    expect(await level('MA352', f.main, 'available')).toBe(3)
    expect(await level('MA352', f.dock, 'received')).toBe(0)
    const serials = await rows(
      sql`SELECT serial, current_state::text AS state, location_id FROM serial_numbers WHERE serial IN ('DMG-1', 'DMG-2') ORDER BY serial`,
    )
    expect(serials).toEqual([
      { serial: 'DMG-1', state: 'available', location_id: f.main },
      { serial: 'DMG-2', state: 'quarantine', location_id: f.dock },
    ])

    const user = await staff(payload())
    const stored = await payload().findByID({
      collection: 'goods-receipts',
      id: r.id,
      user,
      overrideAccess: false,
      depth: 0,
    })
    expect(stored.lines?.[0]?.exceptions).toEqual([
      expect.objectContaining({ type: 'damaged', qty: 2, note: 'Crushed cartons' }),
    ])
    expect(stored.lines?.[1]?.exceptions).toEqual([
      expect.objectContaining({ type: 'damaged', serials: ['DMG-2'] }),
    ])
    expect(stored).toMatchObject({ putawayLocation: f.main })
    expect(stored.putawayAt).toBeTruthy()
    expect((await refusal(receiving.putaway(r.id, { location: f.main }))).code).toBe(
      'receipt-already-put-away',
    )
    expect(checkInvariants(await ledgerSnapshot(payload()))).toEqual([])
  })

  it('refuses a put-away location in another warehouse', async () => {
    const a = await seedPurchasing(payload())
    const b = await seedPurchasing(payload())
    const r = await draftReceipt(payload(), a, [{ poLine: a.bulk, sku: 'MA352', qty: 1 }])
    const receiving = createReceiving(payload())
    await receiving.postReceipt(r.id)
    expect((await refusal(receiving.putaway(r.id, { location: b.main }))).code).toBe(
      'wrong-warehouse',
    )
  })
})

describe('openPurchaseEta', () => {
  it('returns the earliest expected date with an outstanding quantity in the market, or none', async () => {
    const line = (sku: string, qtyOrdered = 2) => ({ sku, qtyOrdered, unitCost: 1000 })
    const later = await seedPurchasing(payload(), {
      expectedAt: '2026-12-20T00:00:00.000Z',
      lines: [line('ETA-SKU')],
    })
    await seedPurchasing(payload(), {
      expectedAt: '2026-12-01T00:00:00.000Z',
      lines: [line('ETA-SKU')],
    })
    await seedPurchasing(payload(), {
      status: 'draft',
      expectedAt: '2026-11-01T00:00:00.000Z',
      lines: [line('ETA-SKU')],
    })
    const cancelled = await seedPurchasing(payload(), {
      expectedAt: '2026-11-05T00:00:00.000Z',
      lines: [line('ETA-SKU')],
    })
    const user = await staff(payload())
    await payload().update({
      collection: 'purchase-orders',
      id: cancelled.po.id,
      data: { status: 'cancelled' },
      user,
      overrideAccess: false,
    })

    const receiving = createReceiving(payload())
    expect(await receiving.openPurchaseEta('ETA-SKU', 'ae')).toEqual(
      new Date('2026-12-01T00:00:00.000Z'),
    )
    expect(await receiving.openPurchaseEta('ETA-SKU', 'sa')).toBeNull()
    expect(await receiving.openPurchaseEta('NO-SUCH-SKU', 'ae')).toBeNull()

    // A fully received line no longer promises anything, even if the PO stays open for others.
    const filled = await seedPurchasing(payload(), {
      expectedAt: '2026-11-10T00:00:00.000Z',
      lines: [line('ETA-FILLED', 1), line('ETA-OTHER', 5)],
    })
    const r = await draftReceipt(payload(), filled, [
      { poLine: filled.bulk, sku: 'ETA-FILLED', qty: 1 },
    ])
    expect(await receiving.openPurchaseEta('ETA-FILLED', 'ae')).toEqual(
      new Date('2026-11-10T00:00:00.000Z'),
    )
    await receiving.postReceipt(r.id)
    expect(await receiving.openPurchaseEta('ETA-FILLED', 'ae')).toBeNull()
    expect(await receiving.openPurchaseEta('ETA-OTHER', 'ae')).toEqual(
      new Date('2026-11-10T00:00:00.000Z'),
    )
    expect(later.po.status).toBe('ordered')
  })
})

describe('purchase order rules', () => {
  it('freezes lines once ordered and refuses status changes that skip the flow', async () => {
    const f = await seedPurchasing(payload())
    const user = await staff(payload())
    const as = { user, overrideAccess: false } as const
    const lines = (f.po.lines ?? []).map((l) => ({ ...l, qtyOrdered: l.qtyOrdered + 1 }))
    expect(
      (
        await refusal(
          payload().update({ collection: 'purchase-orders', id: f.po.id, data: { lines }, ...as }),
        )
      ).message,
    ).toMatch(/frozen/)
    expect(
      (
        await refusal(
          payload().update({
            collection: 'purchase-orders',
            id: f.po.id,
            data: { status: 'draft' },
            ...as,
          }),
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await refusal(
          payload().update({
            collection: 'purchase-orders',
            id: f.po.id,
            data: { status: 'received' },
            ...as,
          }),
        )
      ).status,
    ).toBe(400)
    // Notes and the expected date can still change.
    const updated = await payload().update({
      collection: 'purchase-orders',
      id: f.po.id,
      data: { notes: 'Vessel delayed', expectedAt: '2026-11-09T00:00:00.000Z' },
      ...as,
    })
    expect(updated.notes).toBe('Vessel delayed')
  })

  it('lets nobody type a received quantity', async () => {
    const f = await seedPurchasing(payload(), {
      status: 'draft',
      lines: [{ sku: 'MA352', qtyOrdered: 2, unitCost: 1, qtyReceived: 2 }],
    })
    expect(f.po.lines?.[0]?.qtyReceived).toBe(0)
    const user = await staff(payload())
    const lines = (f.po.lines ?? []).map((l) => ({ ...l, qtyReceived: 2 }))
    const updated = await payload().update({
      collection: 'purchase-orders',
      id: f.po.id,
      data: { lines },
      user,
      overrideAccess: false,
    })
    expect(updated.lines?.[0]?.qtyReceived).toBe(0)
  })

  it('keeps a posted receipt frozen, in the API and in the database', async () => {
    const f = await seedPurchasing(payload())
    const r = await draftReceipt(payload(), f, [{ poLine: f.bulk, sku: 'MA352', qty: 1 }])
    await createReceiving(payload()).postReceipt(r.id)
    const user = await staff(payload())
    const update = await refusal(
      payload().update({
        collection: 'goods-receipts',
        id: r.id,
        data: { lines: [{ poLine: f.bulk, sku: 'MA352', qty: 9 }] },
        user,
        overrideAccess: false,
      }),
    )
    expect(update.status).toBe(400)
    expect(
      await refusal(
        payload().delete({ collection: 'goods-receipts', id: r.id, user, overrideAccess: false }),
      ),
    ).toBeDefined()
    await expect(
      db(payload()).execute(
        sql`UPDATE goods_receipts_lines SET qty = 9 WHERE _parent_id = ${r.id}`,
      ),
    ).rejects.toThrow()
    await expect(
      db(payload()).execute(sql`UPDATE goods_receipts SET status = 'draft' WHERE id = ${r.id}`),
    ).rejects.toThrow()
    await expect(
      db(payload()).execute(sql`DELETE FROM goods_receipts WHERE id = ${r.id}`),
    ).rejects.toThrow()
    // A draft receipt is still editable.
    const draft = await draftReceipt(payload(), f, [{ poLine: f.bulk, sku: 'MA352', qty: 1 }])
    const edited = await payload().update({
      collection: 'goods-receipts',
      id: draft.id,
      data: { lines: [{ poLine: f.bulk, sku: 'MA352', qty: 2 }] },
      user,
      overrideAccess: false,
    })
    expect(edited.lines?.[0]?.qty).toBe(2)
  })
})

describe('unitCost is staff-only', () => {
  it('is wired to the named access function, which refuses anyone but staff', () => {
    const lines = PurchaseOrders.fields.find((f) => 'name' in f && f.name === 'lines')
    const unitCost = JSON.stringify(lines, (_k, v: unknown) =>
      typeof v === 'function' ? (v === canReadCost ? 'canReadCost' : 'fn') : v,
    )
    expect(unitCost).toMatch(/"name":"unitCost".*"read":"canReadCost"/)
    const req = (user: unknown) =>
      ({ req: { user } }) as unknown as Parameters<typeof canReadCost>[0]
    expect(canReadCost(req(null))).toBe(false)
    expect(canReadCost(req({ id: 1, collection: 'customers' }))).toBe(false)
    expect(canReadCost(req({ id: 1, collection: 'users' }))).toBe(true)
  })

  it('anonymous and non-staff readers get no purchase orders at all; staff see unit cost', async () => {
    const f = await seedPurchasing(payload())
    expect(
      (await refusal(payload().find({ collection: 'purchase-orders', overrideAccess: false })))
        .status,
    ).toBe(403)
    const outsider = {
      id: 1,
      collection: 'customers',
      email: 'buyer@example.com',
    } as unknown as Awaited<ReturnType<typeof staff>>
    expect(
      (
        await refusal(
          payload().findByID({
            collection: 'purchase-orders',
            id: f.po.id,
            user: outsider,
            overrideAccess: false,
          }),
        )
      ).status,
    ).toBe(403)

    const anonymous = await fetchRest(`/api/purchase-orders/${f.po.id}`)
    expect(anonymous.status).toBe(403)
    expect(JSON.stringify(anonymous.body)).not.toContain('unitCost')

    const user = await staff(payload())
    const po = await payload().findByID({
      collection: 'purchase-orders',
      id: f.po.id,
      user,
      overrideAccess: false,
    })
    expect(po.lines?.[0]?.unitCost).toBe(450000)
  })
})

/** Payload's REST handler, called in-process, as the app route does. */
async function fetchRest(path: string, init: RequestInit = {}) {
  const [{ REST_GET }, { default: config }] = await Promise.all([
    import('@payloadcms/next/routes'),
    import('@payload-config'),
  ])
  const slug = path.replace(/^\/api\//, '').split('/')
  const response = await REST_GET(config)(new Request(`http://localhost:3000${path}`, init), {
    params: Promise.resolve({ slug }),
  })
  return { status: response.status, body: (await response.json()) as unknown }
}

describe('POST /api/v1/ops/receipts/{id}/post and /putaway', () => {
  const call = async (
    handler: typeof postReceipt,
    id: string | number,
    body: unknown,
    headers: Record<string, string> = {},
  ) => {
    const request = new Request(`http://localhost:3000/api/v1/ops/receipts/${id}/x`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? null : JSON.stringify(body),
    })
    const response = await handler(payload(), request, String(id))
    return {
      status: response.status,
      cache: response.headers.get('cache-control'),
      body: (await response.json()) as Record<string, unknown>,
    }
  }
  const token = async () => {
    await staff(payload())
    const { token } = await payload().login({
      collection: 'users',
      data: { email: 'ops@alpha.test', password: 'integration-password-1' },
    })
    return { authorization: `JWT ${token ?? ''}` }
  }

  it('refuses requests without a staff session, and cross-site requests', async () => {
    const f = await seedPurchasing(payload())
    const r = await draftReceipt(payload(), f, [{ poLine: f.bulk, sku: 'MA352', qty: 1 }])
    expect(await call(postReceipt, r.id, {})).toMatchObject({
      status: 401,
      cache: 'private, no-store',
    })
    expect((await call(putawayReceipt, r.id, { location: f.main })).status).toBe(401)
    expect((await call(postReceipt, r.id, {}, { authorization: 'JWT not-a-token' })).status).toBe(
      401,
    )
    expect(
      (await call(postReceipt, r.id, {}, { ...(await token()), origin: 'https://evil.example' }))
        .status,
    ).toBe(403)
    expect(await receiptMovements(r.number)).toEqual([])
  })

  it('posts and puts away for staff, validating input and mapping refusals', async () => {
    const f = await seedPurchasing(payload())
    const r = await draftReceipt(payload(), f, [{ poLine: f.bulk, sku: 'MA352', qty: 3 }])
    const auth = await token()
    expect((await call(postReceipt, r.id, { companyId: 7 }, auth)).status).toBe(400)
    expect(await call(postReceipt, 'abc', {}, auth)).toMatchObject({ status: 404 })
    expect(await call(postReceipt, 999_999, {}, auth)).toMatchObject({
      status: 404,
      body: { error: { code: 'receipt-not-found' } },
    })
    expect((await call(putawayReceipt, r.id, { location: f.main }, auth)).body).toMatchObject({
      error: { code: 'receipt-not-posted' },
    })

    expect(
      await call(postReceipt, r.id, undefined, { ...auth, origin: 'http://localhost:3000' }),
    ).toMatchObject({
      status: 200,
      cache: 'private, no-store',
      body: { booked: 3, quarantined: 0, unbooked: 0, poStatus: 'partially_received' },
    })
    expect(await call(postReceipt, r.id, {}, auth)).toMatchObject({
      status: 409,
      body: { error: { code: 'receipt-already-posted' } },
    })
    expect((await call(putawayReceipt, r.id, { location: 'A01' }, auth)).status).toBe(400)
    expect(await call(putawayReceipt, r.id, { location: 999_999 }, auth)).toMatchObject({
      status: 422,
      body: { error: { code: 'unknown-location' } },
    })
    expect(await call(putawayReceipt, r.id, { location: f.main }, auth)).toMatchObject({
      status: 200,
      body: { available: 3 },
    })
    const user = await staff(payload())
    const movements = await rows(
      sql`SELECT DISTINCT user_id FROM stock_movements WHERE doc_id = ${r.number}`,
    )
    expect(movements).toEqual([{ user_id: user.id }])
  })

  it('names the serial when a serialised line cannot be posted', async () => {
    const f = await seedPurchasing(payload())
    const r = await draftReceipt(payload(), f, [
      { poLine: f.serialised, sku: 'MC462', qty: 2, serials: ['API-DUP', 'API-DUP'] },
    ])
    expect(await call(postReceipt, r.id, {}, await token())).toMatchObject({
      status: 422,
      body: { error: { code: 'serial-duplicate', detail: { serial: 'API-DUP' } } },
    })
  })
})
