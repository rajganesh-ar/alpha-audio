import { beforeAll, describe, expect, it, vi } from 'vitest'
import { sql } from '@payloadcms/db-postgres/drizzle'
import {
  SandboxPaymentProvider,
  createCheckout,
  createLedger,
  loadShopperOrder,
  seedMarkets,
} from '@alpha/payload'
import { db, seedInventory, staff, type InventoryFixture } from './helpers/ledger'
import { usePayload } from './helpers/suite'

// Outside Next.js there is no incremental cache.
vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

/**
 * Task 0009 acceptance criteria against a migrated Postgres: the bag and checkout handlers, the
 * sandbox provider and webhook, the expiry job's service call, and access to the new
 * collections. Handlers are called directly with real `Request`s.
 */
const payload = usePayload()
const ORIGIN = 'http://localhost:3000'
const SECRET = 'integration-sandbox-secret-000000000000000000000000'
const provider = new SandboxPaymentProvider(
  SECRET,
  (intent, query) => `/ae/en/checkout/sandbox/${intent}/?${query}`,
)

let api: typeof import('@/lib/api/bag')
let checkoutApi: typeof import('@/lib/api/checkout')
let inventory: InventoryFixture
const SKU = {
  inStock: 'CHK-AMP',
  scarce: 'CHK-DAC',
  none: 'CHK-NONE',
  request: 'CHK-REQ',
  noRights: 'CHK-NORIGHTS',
}

type Refusal = Error & { status?: number }
async function refusal(action: Promise<unknown>): Promise<Refusal> {
  try {
    await action
  } catch (error) {
    return error as Refusal
  }
  throw new Error('expected the operation to be refused')
}

const form = (path: string, fields: Record<string, string>, cookie = '', origin = ORIGIN) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin,
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(fields),
  })

/** A shopper: a cookie jar over the bag cookie. */
function shopper() {
  let cookie = ''
  return {
    get cookie() {
      return cookie
    },
    async add(sku: string, qty = 1, mode: 'add' | 'set' = 'add') {
      const res = await api.postBagLine(
        payload(),
        form('/api/v1/markets/ae/bag/lines', { sku, qty: String(qty), mode, locale: 'en' }, cookie),
        'ae',
      )
      const set = res.headers.get('set-cookie')
      if (set) cookie = set.split(';')[0] ?? ''
      return res
    },
    checkout(key: string, patch: Record<string, string> = {}) {
      return checkoutApi.postCheckout(
        { payload: payload(), provider: () => provider },
        form(
          '/api/v1/markets/ae/checkout',
          {
            locale: 'en',
            key,
            name: 'Layla Haddad',
            email: 'layla@example.com',
            phone: '+971 50 123 4567',
            city: 'Dubai',
            area: 'Al Quoz',
            street: 'Street 6A',
            building: 'Warehouse 12',
            method: 'card',
            ...patch,
          },
          cookie,
        ),
        'ae',
      )
    },
  }
}

const webhook = (body: string, signature: string) =>
  checkoutApi.postWebhook(
    { payload: payload(), provider: () => provider },
    new Request(`${ORIGIN}/api/webhooks/sandbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sandbox-signature': signature },
      body,
    }),
    'sandbox',
  )

const rows = async (query: ReturnType<typeof sql>) =>
  (await db(payload()).execute(query)).rows as Array<Record<string, unknown>>
const activeHolds = (docType: string, docId: string) =>
  rows(
    sql`SELECT sku, qty::int AS qty, expires_at FROM reservations WHERE doc_type = ${docType} AND doc_id = ${docId} AND status = 'active' ORDER BY sku`,
  )
const orderRow = async (number: string) =>
  (
    await rows(
      sql`SELECT id, status::text AS status, failure_reason::text AS failure_reason, payment_intent_id, payment_status::text AS payment_status FROM orders WHERE number = ${number}`,
    )
  )[0]
const sellable = (sku: string) => createLedger(payload()).sellable(sku, 'ae')
const intentOf = (location: string) => /sandbox\/(sbx_[0-9a-f]+)\//.exec(location)?.[1] ?? ''
const numberOf = (location: string) => new URL(location, ORIGIN).searchParams.get('order') ?? ''
let keys = 0
const freshKey = () => `integration-form-key-${String(++keys).padStart(4, '0')}`

beforeAll(async () => {
  api = await import('@/lib/api/bag')
  checkoutApi = await import('@/lib/api/checkout')
  await seedMarkets(payload())
  inventory = await seedInventory(payload())
  const user = await staff(payload())
  const ctx = { user, overrideAccess: false, context: { disableRevalidate: true } } as const
  const brand = await payload().create({
    collection: 'brands',
    data: {
      name: 'Checkout brand',
      slug: 'chk-brand',
      priceDisplay: 'show',
      arabicReview: 'draft',
      _status: 'published',
    },
    ...ctx,
  })
  const unlicensed = await payload().create({
    collection: 'brands',
    data: {
      name: 'No rights',
      slug: 'chk-norights',
      priceDisplay: 'show',
      arabicReview: 'draft',
      _status: 'published',
    },
    ...ctx,
  })
  await payload().create({
    collection: 'brand-agreements',
    data: {
      brand: brand.id,
      market: 'ae',
      role: 'distributor',
      exclusive: false,
      leadRouting: 'alpha',
      validFrom: '2024-01-01T00:00:00.000Z',
    },
    ...ctx,
  })
  const product = (sku: string, brandId: number, entry: Record<string, unknown> = {}) =>
    payload().create({
      collection: 'products',
      data: {
        title: `${sku} title`,
        slug: sku.toLowerCase(),
        sku,
        brand: brandId,
        markets: [{ market: 'ae', published: true, rrpInclVat: 1_050_000, ...entry }],
        lifecycle: 'active',
        arabicReview: 'draft',
        _status: 'published',
      },
      ...ctx,
    })
  await Promise.all([
    product(SKU.inStock, brand.id),
    product(SKU.scarce, brand.id, { rrpInclVat: 210_000 }),
    product(SKU.none, brand.id),
    product(SKU.request, brand.id, { priceDisplay: 'request' }),
    product(SKU.noRights, unlicensed.id),
  ])
  const ledger = createLedger(payload())
  for (const [sku, qty] of [
    [SKU.inStock, 50],
    [SKU.scarce, 1],
  ] as const) {
    await ledger.move({
      sku,
      qty,
      from: null,
      to: 'available',
      location: inventory.main,
      doc: { type: 'opening', id: 'OB-CHK' },
      user: user.id,
    })
  }
})

describe('bag', () => {
  it('adds with a form post: 303 to the bag, an httpOnly SameSite=Lax cookie, never cached', async () => {
    const res = await shopper().add(SKU.inStock)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/ae/en/bag/?status=added')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.get('set-cookie')).toMatch(
      /^alpha_bag_ae=[\w-]{43}; Path=\/; Max-Age=604800; HttpOnly; SameSite=Lax$/,
    )
  })

  it('changes and removes lines, prices from the catalogue with VAT per line, and keeps the token hashed', async () => {
    const s = shopper()
    await s.add(SKU.inStock)
    await s.add(SKU.inStock, 2)
    await s.add(SKU.scarce)
    const { viewBag } = await import('@/lib/commerce/bag')
    const { resolveMarketRoute, getMarketsCached } = await import('@alpha/payload')
    const route = resolveMarketRoute(await getMarketsCached(payload()), 'ae', 'en')
    if (!route) throw new Error('ae/en is not routable')
    const token = decodeURIComponent(s.cookie.split('=')[1] ?? '')
    let view = await viewBag(payload(), route, token)
    expect(view.lines.map((l) => [l.sku, l.qty])).toEqual([
      [SKU.inStock, 3],
      [SKU.scarce, 1],
    ])
    // 3 × 10,500.00 and 1 × 2,100.00, VAT = total × 5 ÷ 105 per line, summed.
    expect(view.bag.totals.total.amount).toBe(3_360_000n)
    expect(view.bag.totals.vat.amount).toBe(150_000n + 10_000n)

    expect((await s.add(SKU.inStock, 1, 'set')).headers.get('location')).toBe(
      '/ae/en/bag/?status=updated',
    )
    expect((await s.add(SKU.scarce, 0, 'set')).headers.get('location')).toBe(
      '/ae/en/bag/?status=removed',
    )
    view = await viewBag(payload(), route, token)
    expect(view.lines.map((l) => [l.sku, l.qty])).toEqual([[SKU.inStock, 1]])

    const stored = await rows(sql`SELECT token_hash FROM carts`)
    expect(stored.some((r) => r['token_hash'] === token)).toBe(false)
  })

  it('announces a price that moved since the line was added', async () => {
    const s = shopper()
    await s.add(SKU.scarce)
    const { viewBag } = await import('@/lib/commerce/bag')
    const { resolveMarketRoute, getMarketsCached } = await import('@alpha/payload')
    const route = resolveMarketRoute(await getMarketsCached(payload()), 'ae', 'en')
    if (!route) throw new Error('ae/en is not routable')
    await db(payload()).execute(
      sql`UPDATE carts_lines SET price_snapshot = 200000 WHERE sku = ${SKU.scarce}`,
    )
    const token = decodeURIComponent(s.cookie.split('=')[1] ?? '')
    const line = (await viewBag(payload(), route, token)).lines[0]
    expect(line?.priceChangedFrom?.amount).toBe(200_000n)
    expect(line?.line?.unitPrice.amount).toBe(210_000n)
  })

  it('refuses products not on sale or priced on request, cross-site posts and bad input', async () => {
    const s = shopper()
    for (const sku of [SKU.noRights, SKU.request, 'CHK-MISSING']) {
      expect((await s.add(sku)).headers.get('location')).toBe('/ae/en/bag/?status=not-on-sale')
    }
    const crossSite = await api.postBagLine(
      payload(),
      form(
        '/api/v1/markets/ae/bag/lines',
        { sku: SKU.inStock, qty: '1', locale: 'en' },
        '',
        'https://evil.example',
      ),
      'ae',
    )
    expect(crossSite.status).toBe(403)
    const json = await api.postBagLine(
      payload(),
      new Request(`${ORIGIN}/api/v1/markets/ae/bag/lines`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku: SKU.inStock, qty: 11, locale: 'en' }),
      }),
      'ae',
    )
    expect(json.status).toBe(400)
    const unknownMarket = await api.postBagLine(
      payload(),
      form('/api/v1/markets/zz/bag/lines', { sku: SKU.inStock, qty: '1', locale: 'en' }),
      'zz',
    )
    expect(unknownMarket.status).toBe(404)
  })
})

describe('checkout', () => {
  it('holds every line for 15 minutes, or none, and names the line that failed', async () => {
    const s = shopper()
    await s.add(SKU.inStock, 2)
    await s.add(SKU.none)
    const before = await sellable(SKU.inStock)
    const res = await s.checkout(freshKey())
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`/ae/en/checkout/?status=unavailable&sku=${SKU.none}`)
    expect(await sellable(SKU.inStock)).toBe(before)
    const orders = await rows(
      sql`SELECT number, status::text AS status FROM orders WHERE status = 'unavailable'`,
    )
    expect(orders).toHaveLength(1)
    expect(await activeHolds('cart', String(orders[0]?.['number']))).toEqual([])
  })

  it('creates one order and one payment for a double submit, then a capture confirms it', async () => {
    const s = shopper()
    await s.add(SKU.inStock, 2)
    const key = freshKey()
    const [a, b] = await Promise.all([s.checkout(key), s.checkout(key)])
    const resubmit = await s.checkout(key)
    const locations = [a, b, resubmit].map((r) => r.headers.get('location') ?? '')
    const intent = intentOf(resubmit.headers.get('location') ?? '')
    expect(intent).toMatch(/^sbx_/)
    // A concurrent twin either gets the same payment page or, while the winner is still
    // reserving, the order's result page (which refreshes itself); never a second order.
    for (const location of locations) {
      if (location.includes('/sandbox/')) expect(intentOf(location)).toBe(intent)
      else expect(location).toMatch(/^\/ae\/en\/checkout\/return\/\?order=/)
    }
    const number = numberOf(resubmit.headers.get('location') ?? '')
    expect(number).toMatch(/^AE-\d{4}-\d{6}$/)
    const orders = await rows(
      sql`SELECT id FROM orders WHERE idempotency_key IN (SELECT idempotency_key FROM orders WHERE number = ${number})`,
    )
    expect(orders).toHaveLength(1)

    const holds = await activeHolds('cart', number)
    expect(holds).toHaveLength(1)
    const expires = new Date(String(holds[0]?.['expires_at'])).getTime()
    expect(expires - Date.now()).toBeGreaterThan(14 * 60_000)
    expect(expires - Date.now()).toBeLessThanOrEqual(15 * 60_000)

    const capture = provider.event(
      intent,
      'captured',
      { amount: 2_100_000n, currency: 'AED', decimals: 2 },
      'evt_capture_1',
    )
    const first = await webhook(capture.body, capture.signature)
    expect(await first.json()).toEqual({ outcome: 'confirmed' })
    expect(await orderRow(number)).toMatchObject({
      status: 'confirmed',
      payment_status: 'captured',
    })
    expect(await activeHolds('cart', number)).toEqual([])
    expect(await activeHolds('order', number)).toEqual([
      { sku: SKU.inStock, qty: 2, expires_at: null },
    ])
    const carts = await rows(
      sql`SELECT status::text AS status FROM carts WHERE order_id = ${Number((await orderRow(number))?.['id'])}`,
    )
    expect(carts).toEqual([{ status: 'converted' }])

    // A replay (same event id) changes nothing.
    const after = await sellable(SKU.inStock)
    const replay = await webhook(capture.body, capture.signature)
    expect(await replay.json()).toEqual({ outcome: 'duplicate' })
    expect(await sellable(SKU.inStock)).toBe(after)
    // A second capture event for the same intent changes nothing either.
    const again = provider.event(
      intent,
      'captured',
      { amount: 2_100_000n, currency: 'AED', decimals: 2 },
      'evt_capture_2',
    )
    expect(await (await webhook(again.body, again.signature)).json()).toEqual({
      outcome: 'already-confirmed',
    })
    expect(await activeHolds('order', number)).toHaveLength(1)
  })

  it('refuses forged webhooks and unknown providers', async () => {
    const event = provider.event(
      'sbx_unknown',
      'captured',
      { amount: 1n, currency: 'AED', decimals: 2 },
      'evt_forged',
    )
    expect((await webhook(event.body, 'f'.repeat(64))).status).toBe(401)
    const unknown = await checkoutApi.postWebhook(
      { payload: payload(), provider: () => provider },
      new Request(`${ORIGIN}/api/webhooks/other`, { method: 'POST', body: event.body }),
      'other',
    )
    expect(unknown.status).toBe(404)
  })

  it('releases the stock on a decline and marks the order failed', async () => {
    const s = shopper()
    await s.add(SKU.inStock)
    const before = await sellable(SKU.inStock)
    const location = (await s.checkout(freshKey())).headers.get('location') ?? ''
    expect(await sellable(SKU.inStock)).toBe(before - 1)
    const decline = provider.event(
      intentOf(location),
      'declined',
      { amount: 1_050_000n, currency: 'AED', decimals: 2 },
      'evt_decline_1',
    )
    expect(await (await webhook(decline.body, decline.signature)).json()).toEqual({
      outcome: 'failed',
    })
    expect(await sellable(SKU.inStock)).toBe(before)
    expect(await orderRow(numberOf(location))).toMatchObject({
      status: 'failed',
      failure_reason: 'declined',
    })
  })

  it('refuses a capture whose amount or currency does not match the order', async () => {
    const s = shopper()
    await s.add(SKU.inStock)
    const before = await sellable(SKU.inStock)
    const location = (await s.checkout(freshKey())).headers.get('location') ?? ''
    const short = provider.event(
      intentOf(location),
      'captured',
      { amount: 1_000n, currency: 'AED', decimals: 2 },
      'evt_short',
    )
    expect(await (await webhook(short.body, short.signature)).json()).toEqual({
      outcome: 'mismatch',
    })
    expect(await orderRow(numberOf(location))).toMatchObject({
      status: 'failed',
      failure_reason: 'amount-mismatch',
    })
    expect(await sellable(SKU.inStock)).toBe(before)

    const s2 = shopper()
    await s2.add(SKU.inStock)
    const other = (await s2.checkout(freshKey())).headers.get('location') ?? ''
    const currency = provider.event(
      intentOf(other),
      'captured',
      { amount: 1_050_000n, currency: 'SAR', decimals: 2 },
      'evt_currency',
    )
    expect(await (await webhook(currency.body, currency.signature)).json()).toEqual({
      outcome: 'mismatch',
    })
  })

  it('returns to the form with the draft kept when details are invalid, and needs a valid form key', async () => {
    const s = shopper()
    await s.add(SKU.inStock)
    const invalid = await s.checkout(freshKey(), { phone: '12', email: 'nope' })
    expect(invalid.headers.get('location')).toBe('/ae/en/checkout/?status=invalid')
    const drafts = await rows(sql`SELECT draft FROM carts WHERE draft->>'phone' = '12'`)
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.['draft']).toMatchObject({
      name: 'Layla Haddad',
      email: 'nope',
      phone: '12',
    })
    const method = await s.checkout(freshKey(), { method: 'knet' })
    expect(method.headers.get('location')).toBe('/ae/en/checkout/?status=invalid')
    const expired = await s.checkout('short')
    expect(expired.headers.get('location')).toBe('/ae/en/checkout/?status=expired')
    const noBag = await checkoutApi.postCheckout(
      { payload: payload(), provider: () => provider },
      form('/api/v1/markets/ae/checkout', { locale: 'en', key: freshKey() }),
      'ae',
    )
    expect(noBag.headers.get('location')).toBe('/ae/en/bag/')
  })

  it('leaves orders whose holds lapsed expired, and a late capture re-reserves or fails for refund', async () => {
    const lateNow = () => new Date(Date.now() + 20 * 60_000)
    const s = shopper()
    await s.add(SKU.inStock)
    const ok = (await s.checkout(freshKey())).headers.get('location') ?? ''
    const t = shopper()
    await t.add(SKU.scarce)
    const lost = (await t.checkout(freshKey())).headers.get('location') ?? ''

    // 20 minutes on: the ledger job releases lapsed holds, the checkout job expires the orders.
    await createLedger(payload(), lateNow).releaseExpiredReservations()
    expect(await createCheckout(payload(), provider, lateNow).expire()).toBeGreaterThanOrEqual(2)
    expect(await orderRow(numberOf(ok))).toMatchObject({ status: 'expired' })
    expect(await orderRow(numberOf(lost))).toMatchObject({ status: 'expired' })

    // Someone else buys the last scarce unit meanwhile.
    const rival = shopper()
    await rival.add(SKU.scarce)
    expect((await rival.checkout(freshKey())).headers.get('location')).toMatch(/sandbox/)

    const late = provider.event(
      intentOf(ok),
      'captured',
      { amount: 1_050_000n, currency: 'AED', decimals: 2 },
      'evt_late_ok',
    )
    expect(await (await webhook(late.body, late.signature)).json()).toEqual({
      outcome: 'confirmed',
    })
    expect(await activeHolds('order', numberOf(ok))).toEqual([
      { sku: SKU.inStock, qty: 1, expires_at: null },
    ])

    const tooLate = provider.event(
      intentOf(lost),
      'captured',
      { amount: 210_000n, currency: 'AED', decimals: 2 },
      'evt_late_lost',
    )
    expect(await (await webhook(tooLate.body, tooLate.signature)).json()).toEqual({
      outcome: 'stock-lost',
    })
    expect(await orderRow(numberOf(lost))).toMatchObject({
      status: 'failed',
      failure_reason: 'stock-lost',
    })
  })

  it('the sandbox page posts a signed event and returns to the order page', async () => {
    const s = shopper()
    await s.add(SKU.inStock)
    const location = (await s.checkout(freshKey())).headers.get('location') ?? ''
    const query = new URL(location, ORIGIN).search.slice(1)
    const res = await checkoutApi.postSandboxPayment(
      { payload: payload(), provider: () => provider },
      form(`/api/v1/markets/ae/checkout/sandbox/${intentOf(location)}`, {
        action: 'pay',
        q: query,
      }),
      intentOf(location),
    )
    expect(res.status).toBe(303)
    const back = res.headers.get('location') ?? ''
    expect(back).toMatch(/^\/ae\/en\/checkout\/return\/\?order=AE-\d{4}-\d{6}&token=[\w-]+$/)
    expect(await orderRow(numberOf(back))).toMatchObject({ status: 'confirmed' })
    const tampered = query.replace(/amount=\d+/, 'amount=1')
    const forged = await checkoutApi.postSandboxPayment(
      { payload: payload(), provider: () => provider },
      form(`/api/v1/markets/ae/checkout/sandbox/${intentOf(location)}`, {
        action: 'pay',
        q: tampered,
      }),
      intentOf(location),
    )
    expect(forged.status).toBe(400)
  })
})

describe('privacy', () => {
  it('orders, carts and webhook events cannot be read anonymously; staff read orders but never create or delete them', async () => {
    for (const collection of ['orders', 'carts', 'webhook-events'] as const) {
      expect((await refusal(payload().find({ collection, overrideAccess: false }))).status).toBe(
        403,
      )
    }
    const user = await staff(payload())
    expect(
      (
        await refusal(
          payload().create({
            collection: 'orders',
            data: {} as never,
            user,
            overrideAccess: false,
          }),
        )
      ).status,
    ).toBe(403)
    const order = (
      await payload().find({ collection: 'orders', limit: 1, user, overrideAccess: false })
    ).docs[0]
    expect(order).toBeDefined()
    expect(
      (
        await refusal(
          payload().delete({
            collection: 'orders',
            id: order?.id ?? 0,
            user,
            overrideAccess: false,
          }),
        )
      ).status,
    ).toBe(403)
    expect(
      (await refusal(payload().find({ collection: 'carts', user, overrideAccess: false }))).status,
    ).toBe(403)
  })

  it('shows an order to the shopper only with the token from its link', async () => {
    const s = shopper()
    await s.add(SKU.inStock)
    const location = (await s.checkout(freshKey())).headers.get('location') ?? ''
    const returnUrl = new URL(new URL(location, ORIGIN).searchParams.get('return') ?? '')
    const number = returnUrl.searchParams.get('order') ?? ''
    const token = returnUrl.searchParams.get('token') ?? ''
    expect(await loadShopperOrder(payload(), number, token)).toMatchObject({
      number,
      status: 'paying',
    })
    expect(await loadShopperOrder(payload(), number, `${token.slice(0, -1)}x`)).toBeNull()
    expect(await loadShopperOrder(payload(), number, '')).toBeNull()
    const stored = await rows(sql`SELECT access_token_hash FROM orders WHERE number = ${number}`)
    expect(stored[0]?.['access_token_hash']).not.toBe(token)
  })
})
