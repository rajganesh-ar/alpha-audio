import { beforeAll, describe, expect, it, vi } from 'vitest'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { checkInvariants } from '@alpha/core/testing'
import type { PaymentProvider } from '@alpha/core'
import {
  createLedger,
  deliverNotification,
  loadShopperOrder,
  renderNotification,
} from '@alpha/payload'
import { ORIGIN, form, placeOrder, sandbox, seedShop } from './helpers/commerce'
import { db, ledgerSnapshot, staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

/**
 * Task 0010 acceptance criteria against a migrated Postgres: the ops order handlers driving
 * FulfilmentService over the real ledger, refunds, the notification outbox and its job, and
 * access to shipments and notifications.
 */
const payload = usePayload()
const AMP = 'FUL-AMP'
const SPK = 'FUL-SPK'
let ops: typeof import('@/lib/api/opsOrders')
let auth: Record<string, string>

const rows = async (query: ReturnType<typeof sql>) =>
  (await db(payload()).execute(query)).rows as Array<Record<string, unknown>>
const level = async (sku: string, state: string) =>
  Number(
    (
      await rows(
        sql`SELECT COALESCE(SUM(qty), 0) AS qty FROM stock_levels WHERE sku = ${sku} AND state = ${state}`,
      )
    )[0]?.['qty'] ?? 0,
  )
const order = async (number: string) =>
  (
    await rows(sql`
      SELECT fulfilment::text AS fulfilment, refund_status::text AS refund, refund_amount::int AS refund_amount, refund_reference, cancel_reason, totals_total
      FROM orders WHERE number = ${number}`)
  )[0]
const outbox = (number: string) =>
  rows(
    sql`SELECT template::text AS template, status::text AS status, "to" FROM notifications WHERE key LIKE ${`${number}:%`} ORDER BY id`,
  )

/** An ops action as the staff member (JSON), or with the given headers and body. */
async function act(
  number: string,
  action: string,
  body: Record<string, string> = {},
  options: {
    headers?: Record<string, string>
    provider?: () => PaymentProvider | null
    asForm?: boolean
  } = {},
) {
  const headers = { origin: ORIGIN, ...(options.headers ?? auth) }
  const request = options.asForm
    ? form(`/api/v1/ops/orders/${number}/${action}`, body, headers)
    : new Request(`${ORIGIN}/api/v1/ops/orders/${number}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      })
  const res = await ops.postOrderAction(
    { payload: payload(), provider: options.provider ?? (() => sandbox) },
    request,
    number,
    action,
  )
  const text = await res.text()
  return {
    status: res.status,
    location: res.headers.get('location'),
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  }
}

const ship = {
  courier: 'Aramex',
  trackingNumber: '44219988',
  trackingUrl: 'https://www.aramex.com/track/44219988',
}

beforeAll(async () => {
  ops = await import('@/lib/api/opsOrders')
  await seedShop(payload(), 'ful-brand', [
    { sku: AMP, price: 1_050_000, qty: 20 },
    { sku: SPK, price: 420_000, serials: ['FUL-SN-1', 'FUL-SN-2', 'FUL-SN-3'] },
  ])
  const user = await staff(payload())
  const { token } = await payload().login({
    collection: 'users',
    data: { email: user.email, password: 'integration-password-1' },
  })
  auth = { authorization: `JWT ${token}` }
})

describe('fulfilment', () => {
  it('picks, ships and delivers every line by reservation, serials included, and keeps the ledger whole', async () => {
    const { number } = await placeOrder(payload(), [
      { sku: AMP, qty: 2 },
      { sku: SPK, qty: 2 },
    ])
    const before = { amp: await level(AMP, 'reserved'), spk: await level(SPK, 'reserved') }
    expect(before).toEqual({ amp: 2, spk: 2 })

    expect(await act(number, 'pick')).toMatchObject({
      status: 200,
      body: { fulfilment: 'picked', changed: true },
    })
    expect([
      await level(AMP, 'picked'),
      await level(SPK, 'picked'),
      await level(AMP, 'reserved'),
    ]).toEqual([2, 2, 0])
    expect(await act(number, 'pick')).toMatchObject({ status: 200, body: { changed: false } })

    const shipped = await act(number, 'ship', ship)
    expect(shipped).toMatchObject({ status: 200, body: { fulfilment: 'shipped' } })
    expect(shipped.body['shipment']).toMatch(/^SH-\d{4}-\d{6}$/)
    expect([
      await level(AMP, 'shipped'),
      await level(SPK, 'shipped'),
      await level(AMP, 'picked'),
    ]).toEqual([2, 2, 0])
    const serials = await rows(
      sql`SELECT serial, current_state::text AS state FROM serial_numbers WHERE sku = ${SPK} ORDER BY serial`,
    )
    expect(serials.filter((s) => s['state'] === 'shipped')).toHaveLength(2)
    const movement = await rows(
      sql`SELECT doc_type::text AS doc_type, doc_id FROM stock_movements WHERE sku = ${AMP} AND to_state = 'shipped'`,
    )
    expect(movement).toEqual([{ doc_type: 'shipment', doc_id: shipped.body['shipment'] }])

    expect(await act(number, 'deliver')).toMatchObject({
      status: 200,
      body: { fulfilment: 'delivered' },
    })
    expect([await level(AMP, 'delivered'), await level(SPK, 'delivered')]).toEqual([2, 2])

    expect((await outbox(number)).map((n) => n['template'])).toEqual([
      'order-confirmed',
      'order-shipped',
      'order-delivered',
    ])
    expect(checkInvariants(await ledgerSnapshot(payload()))).toEqual([])
  })

  it('runs concurrent identical actions once', async () => {
    const { number } = await placeOrder(payload(), [{ sku: AMP, qty: 1 }])
    const picks = await Promise.all([act(number, 'pick'), act(number, 'pick'), act(number, 'pick')])
    expect(picks.map((p) => p.status)).toEqual([200, 200, 200])
    const ships = await Promise.all([act(number, 'ship', ship), act(number, 'ship', ship)])
    expect(ships.map((s) => s.status)).toEqual([200, 200])
    expect(
      await rows(
        sql`SELECT id FROM shipments WHERE order_id = (SELECT id FROM orders WHERE number = ${number})`,
      ),
    ).toHaveLength(1)
    expect((await outbox(number)).filter((n) => n['template'] === 'order-shipped')).toHaveLength(1)
    expect(checkInvariants(await ledgerSnapshot(payload()))).toEqual([])
  })

  it('refuses steps out of order and explains why', async () => {
    const { number } = await placeOrder(payload(), [{ sku: AMP, qty: 1 }])
    expect(await act(number, 'ship', ship)).toMatchObject({
      status: 409,
      body: { error: { code: 'wrong-status' } },
    })
    expect(await act(number, 'deliver')).toMatchObject({ status: 409 })
    await act(number, 'pick')
    expect(await act(number, 'ship', { courier: 'Aramex', trackingNumber: '!' })).toMatchObject({
      status: 400,
    })
    expect(
      await act(number, 'ship', { ...ship, trackingUrl: 'javascript:alert(1)' }),
    ).toMatchObject({
      status: 422,
      body: { error: { code: 'invalid-shipment' } },
    })
    expect(await act('AE-2026-999999', 'pick')).toMatchObject({ status: 404 })
    expect(await act(number, 'explode')).toMatchObject({ status: 404 })
    // A form post comes back to the order page with the reason.
    expect(await act(number, 'deliver', {}, { asForm: true })).toMatchObject({
      status: 303,
      location: `/ops/orders/${number}/?error=wrong-status`,
    })
  })

  it('cancels before shipment: stock back on the shelf, a full sandbox refund, the customer told', async () => {
    const { number } = await placeOrder(payload(), [{ sku: AMP, qty: 3 }])
    await act(number, 'pick')
    const available = await level(AMP, 'available')
    const res = await act(
      number,
      'cancel',
      { reason: 'Customer changed their mind' },
      { asForm: true },
    )
    expect(res).toMatchObject({ status: 303, location: `/ops/orders/${number}/?result=cancelled` })
    expect(await level(AMP, 'available')).toBe(available + 3)
    expect(await order(number)).toMatchObject({
      fulfilment: 'cancelled',
      refund: 'refunded',
      refund_amount: 3_150_000,
      cancel_reason: 'Customer changed their mind',
    })
    expect(String((await order(number))?.['refund_reference'])).toMatch(/^rf_/)
    expect((await outbox(number)).map((n) => n['template'])).toEqual([
      'order-confirmed',
      'order-cancelled',
    ])
    expect(await act(number, 'refund')).toMatchObject({ status: 200, body: { changed: false } })
    expect(checkInvariants(await ledgerSnapshot(payload()))).toEqual([])
  })

  it('never cancels a shipped order', async () => {
    const { number } = await placeOrder(payload(), [{ sku: AMP, qty: 1 }])
    await act(number, 'pick')
    await act(number, 'ship', ship)
    expect(await act(number, 'cancel', { reason: 'Too late' })).toMatchObject({
      status: 409,
      body: { error: { code: 'wrong-status' } },
    })
    expect((await order(number))?.['fulfilment']).toBe('shipped')
  })

  it('records a refund as manual when the provider cannot refund', async () => {
    const { number } = await placeOrder(payload(), [{ sku: AMP, qty: 1 }])
    const noRefunds = (): PaymentProvider => ({
      id: sandbox.id,
      methods: sandbox.methods,
      createPayment: (r) => sandbox.createPayment(r),
      parseWebhook: (b, h) => sandbox.parseWebhook(b, h),
    })
    expect(
      await act(number, 'cancel', { reason: 'Fraud check' }, { provider: noRefunds }),
    ).toMatchObject({
      status: 200,
      body: { fulfilment: 'cancelled', refund: 'manual' },
    })
    expect(await order(number)).toMatchObject({ refund: 'manual', refund_amount: 1_050_000 })
  })
})

describe('notifications', () => {
  it('queues each email once and the job sends it, with the order link carrying its token', async () => {
    const { number, returnUrl } = await placeOrder(
      payload(),
      [{ sku: AMP, qty: 1 }],
      'noor@example.com',
    )
    const [row] = await rows(
      sql`SELECT id FROM notifications WHERE key = ${`${number}:order-confirmed`}`,
    )
    const id = Number(row?.['id'])
    const jobs = await rows(
      sql`SELECT input FROM payload_jobs WHERE task_slug = 'sendNotification' AND input->>'notification' = ${String(id)}`,
    )
    expect(jobs).toHaveLength(1)

    const rendered = await renderNotification(payload(), id)
    expect(rendered?.email).toMatchObject({
      to: 'noor@example.com',
      subject: `Order ${number} confirmed`,
    })
    const link = /View your order: (\S+)/.exec(rendered?.email.text ?? '')?.[1] ?? ''
    const url = new URL(link)
    expect(url.pathname).toBe(`/ae/en/orders/${number}/`)
    expect(
      await loadShopperOrder(payload(), number, url.searchParams.get('token') ?? ''),
    ).toMatchObject({ number, fulfilment: 'awaiting' })
    // Same token as the confirmation page link.
    expect(url.searchParams.get('token')).toBe(returnUrl.searchParams.get('token'))

    const sent: string[] = []
    expect(
      await deliverNotification(payload(), id, async (email) => void sent.push(email.subject)),
    ).toBe('sent')
    expect(
      await deliverNotification(payload(), id, async (email) => void sent.push(email.subject)),
    ).toBe('already-sent')
    expect(sent).toEqual([`Order ${number} confirmed`])
    expect((await outbox(number))[0]).toMatchObject({ status: 'sent', to: 'noor@example.com' })
  })

  it('counts failed attempts, keeps the error, and marks the row failed after the last one', async () => {
    const { number } = await placeOrder(payload(), [{ sku: AMP, qty: 1 }])
    const [row] = await rows(
      sql`SELECT id FROM notifications WHERE key = ${`${number}:order-confirmed`}`,
    )
    const id = Number(row?.['id'])
    const failing = async () => {
      throw new Error('SMTP 421 try again later')
    }
    for (let attempt = 1; attempt <= 5; attempt++) {
      await expect(deliverNotification(payload(), id, failing)).rejects.toThrow('SMTP 421')
    }
    const [after] = await rows(
      sql`SELECT status::text AS status, attempts::int AS attempts, last_error FROM notifications WHERE id = ${id}`,
    )
    expect(after).toMatchObject({
      status: 'failed',
      attempts: 5,
      last_error: 'SMTP 421 try again later',
    })
  })

  it('runs through the Payload jobs queue', async () => {
    const { number } = await placeOrder(payload(), [{ sku: AMP, qty: 1 }])
    await payload().jobs.run({ queue: 'notifications', limit: 50 })
    expect((await outbox(number))[0]).toMatchObject({ status: 'sent' })
  })

  it('shows shipment and progress on the customer order page data', async () => {
    const { number, returnUrl } = await placeOrder(payload(), [{ sku: AMP, qty: 1 }])
    await act(number, 'pick')
    await act(number, 'ship', ship)
    const view = await loadShopperOrder(
      payload(),
      number,
      returnUrl.searchParams.get('token') ?? '',
    )
    expect(view).toMatchObject({
      fulfilment: 'shipped',
      shipment: {
        courier: 'Aramex',
        trackingNumber: '44219988',
        trackingUrl: ship.trackingUrl,
        deliveredAt: null,
      },
    })
  })
})

describe('access', () => {
  it('refuses anonymous and cross-site ops requests', async () => {
    const { number } = await placeOrder(payload(), [{ sku: AMP, qty: 1 }])
    expect(await act(number, 'pick', {}, { headers: {} })).toMatchObject({ status: 401 })
    expect(await act(number, 'pick', {}, { headers: {}, asForm: true })).toMatchObject({
      status: 303,
      location: `/admin/login?redirect=${encodeURIComponent(`/ops/orders/${number}/`)}`,
    })
    expect(
      await act(number, 'pick', {}, { headers: { ...auth, origin: 'https://evil.example' } }),
    ).toMatchObject({ status: 403 })
    expect((await order(number))?.['fulfilment']).toBe('awaiting')
  })

  it('keeps shipments and notifications from anonymous readers and writers', async () => {
    for (const collection of ['shipments', 'notifications'] as const) {
      await expect(payload().find({ collection, overrideAccess: false })).rejects.toMatchObject({
        status: 403,
      })
    }
    const user = await staff(payload())
    const shipments = await payload().find({ collection: 'shipments', user, overrideAccess: false })
    expect(shipments.totalDocs).toBeGreaterThan(0)
    await expect(
      payload().delete({
        collection: 'shipments',
        id: shipments.docs[0]?.id ?? 0,
        user,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload().update({
        collection: 'notifications',
        where: {},
        data: { status: 'sent' },
        user,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('leaves the ledger whole after every flow', async () => {
    const ledger = createLedger(payload())
    expect(await ledger.sellable(AMP, 'ae')).toBeGreaterThan(0)
    expect(checkInvariants(await ledgerSnapshot(payload()))).toEqual([])
  })
})
