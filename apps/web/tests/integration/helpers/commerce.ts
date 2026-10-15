import type { Payload } from 'payload'
import { SandboxPaymentProvider, createLedger, seedMarkets } from '@alpha/payload'
import { seedInventory, staff, type InventoryFixture } from './ledger'

/**
 * Storefront fixtures for order tests: markets, a UAE warehouse, a licensed brand and products
 * with stock, and a shopper who buys through the real bag, checkout and webhook handlers.
 */
export const ORIGIN = 'http://localhost:3000'
export const sandbox = new SandboxPaymentProvider(
  'integration-sandbox-secret-000000000000000000000000',
  (intent, query) => `/ae/en/checkout/sandbox/${intent}/?${query}`,
)

export const form = (
  path: string,
  fields: Record<string, string>,
  headers: Record<string, string> = {},
) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN, ...headers },
    body: new URLSearchParams(fields),
  })

export interface StockedProduct {
  sku: string
  /** RRP incl. VAT, minor units. */
  price: number
  qty?: number
  serials?: string[]
}

export async function seedShop(
  payload: Payload,
  slug: string,
  products: readonly StockedProduct[],
): Promise<InventoryFixture> {
  await seedMarkets(payload)
  const inventory = await seedInventory(payload)
  const user = await staff(payload)
  const ctx = { user, overrideAccess: false, context: { disableRevalidate: true } } as const
  const brand = await payload.create({
    collection: 'brands',
    data: { name: slug, slug, priceDisplay: 'show', arabicReview: 'draft', _status: 'published' },
    ...ctx,
  })
  await payload.create({
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
  const ledger = createLedger(payload)
  for (const p of products) {
    await payload.create({
      collection: 'products',
      data: {
        title: `${p.sku} title`,
        slug: p.sku.toLowerCase(),
        sku: p.sku,
        brand: brand.id,
        markets: [{ market: 'ae', published: true, rrpInclVat: p.price }],
        lifecycle: 'active',
        arabicReview: 'draft',
        _status: 'published',
      },
      ...ctx,
    })
    const doc = { type: 'opening', id: `OB-${slug}` } as const
    if (p.serials) {
      for (const serial of p.serials)
        await ledger.move({
          sku: p.sku,
          qty: 1,
          serial,
          from: null,
          to: 'available',
          location: inventory.main,
          doc,
          user: user.id,
        })
    } else if (p.qty) {
      await ledger.move({
        sku: p.sku,
        qty: p.qty,
        from: null,
        to: 'available',
        location: inventory.main,
        doc,
        user: user.id,
      })
    }
  }
  return inventory
}

let keys = 0

/** Buys `items` in ae/en and pays: returns the confirmed order's number and its access link. */
export async function placeOrder(
  payload: Payload,
  items: ReadonlyArray<{ sku: string; qty: number }>,
  email = 'layla@example.com',
): Promise<{ number: string; intent: string; returnUrl: URL }> {
  const [{ postBagLine }, { postCheckout, postWebhook }] = await Promise.all([
    import('@/lib/api/bag'),
    import('@/lib/api/checkout'),
  ])
  let cookie = ''
  for (const item of items) {
    const res = await postBagLine(
      payload,
      form(
        '/api/v1/markets/ae/bag/lines',
        { sku: item.sku, qty: String(item.qty), mode: 'add', locale: 'en' },
        cookie ? { cookie } : {},
      ),
      'ae',
    )
    cookie = res.headers.get('set-cookie')?.split(';')[0] ?? cookie
  }
  const res = await postCheckout(
    { payload, provider: () => sandbox },
    form(
      '/api/v1/markets/ae/checkout',
      {
        locale: 'en',
        key: `fulfilment-form-key-${String(++keys).padStart(4, '0')}`,
        name: 'Layla Haddad',
        email,
        phone: '+971501234567',
        city: 'Dubai',
        area: 'Al Quoz',
        street: 'Street 6A',
        building: 'Warehouse 12',
        method: 'card',
      },
      { cookie },
    ),
    'ae',
  )
  const location = new URL(res.headers.get('location') ?? '', ORIGIN)
  const intent = /sandbox\/(sbx_[0-9a-f]+)\//.exec(location.pathname)?.[1]
  const number = location.searchParams.get('order')
  if (!intent || !number) throw new Error(`checkout did not reach payment: ${location.toString()}`)
  const amount = {
    amount: BigInt(location.searchParams.get('amount') ?? '0'),
    currency: 'AED',
    decimals: 2,
  } as const
  const event = sandbox.event(intent, 'captured', amount, `evt_${number}`)
  const hook = await postWebhook(
    { payload, provider: () => sandbox },
    new Request(`${ORIGIN}/api/webhooks/sandbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sandbox-signature': event.signature },
      body: event.body,
    }),
    'sandbox',
  )
  const outcome = ((await hook.json()) as { outcome: string }).outcome
  if (outcome !== 'confirmed') throw new Error(`payment did not confirm: ${outcome}`)
  return { number, intent, returnUrl: new URL(location.searchParams.get('return') ?? '') }
}
