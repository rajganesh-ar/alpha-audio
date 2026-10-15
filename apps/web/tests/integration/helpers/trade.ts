import type { Payload, TypedUser } from 'payload'
import { createLedger, seedMarkets } from '@alpha/payload'
import { seedInventory, staff } from './ledger'

/**
 * Two trade companies with their own users, prices and settings (docs/tasks/0013), for the
 * pricing and leak tests. Alpha Hi-Fi is a dealer with a contract price and exact stock; Beta
 * Systems is an integrator on a buyer group with a price list and hidden stock.
 */
export interface TradeFixture {
  alpha: { id: number }
  beta: { id: number }
  /** Signed-in users (as Payload resolves them from their JWT). */
  alphaOwner: TypedUser
  alphaViewer: TypedUser
  betaOwner: TypedUser
  skus: { amp: string; spk: string }
}

const PASSWORD = 'trade-password-123'

export async function seedTrade(payload: Payload, tag: string): Promise<TradeFixture> {
  await seedMarkets(payload)
  const inventory = await seedInventory(payload)
  const user = await staff(payload)
  const ctx = { user, overrideAccess: false, context: { disableRevalidate: true } } as const
  const brand = await payload.create({
    collection: 'brands',
    data: {
      name: `${tag} brand`,
      slug: `${tag}-brand`,
      priceDisplay: 'show',
      arabicReview: 'draft',
      _status: 'published',
    },
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
  const skus = { amp: `${tag.toUpperCase()}-AMP`, spk: `${tag.toUpperCase()}-SPK` }
  for (const [sku, rrp, cost] of [
    [skus.amp, 1_050_000, 600_000],
    [skus.spk, null, 300_000],
  ] as const) {
    await payload.create({
      collection: 'products',
      data: {
        title: `${sku} title`,
        slug: sku.toLowerCase(),
        sku,
        brand: brand.id,
        markets: [{ market: 'ae', published: true, ...(rrp ? { rrpInclVat: rrp } : {}) }],
        cost,
        lifecycle: 'active',
        arabicReview: 'draft',
        _status: 'published',
      },
      ...ctx,
    })
    await createLedger(payload).move({
      sku,
      qty: 12,
      from: null,
      to: 'available',
      location: inventory.main,
      doc: { type: 'opening', id: `OB-${tag}` },
      user: user.id,
    })
  }
  const list = await payload.create({
    collection: 'price-lists',
    data: {
      name: `${tag} integrators`,
      market: 'ae',
      items: [{ sku: skus.spk, price: 380_000 }],
      _status: 'published',
    },
    ...ctx,
  })
  const group = await payload.create({
    collection: 'buyer-groups',
    data: {
      name: `${tag} integrators`,
      priceList: list.id,
      discounts: [{ brand: brand.id, bps: 500 }],
    },
    ...ctx,
  })
  const alpha = await payload.create({
    collection: 'companies',
    data: {
      name: `${tag} Alpha Hi-Fi`,
      market: 'ae',
      channel: 'dealer',
      creditLimit: 5_000_000,
      settings: { stockVisibility: 'exact' },
    },
    ...ctx,
  })
  const beta = await payload.create({
    collection: 'companies',
    data: {
      name: `${tag} Beta Systems`,
      market: 'ae',
      channel: 'integrator',
      buyerGroup: group.id,
      creditLimit: 2_000_000,
      settings: { stockVisibility: 'hidden' },
    },
    ...ctx,
  })
  await payload.create({
    collection: 'contract-prices',
    data: { company: alpha.id, sku: skus.amp, price: 690_000 },
    ...ctx,
  })
  const account = async (email: string, company: number, role: 'owner' | 'viewer') => {
    await payload.create({
      collection: 'company-users',
      data: { email, password: PASSWORD, company, role },
      ...ctx,
    })
    const { token } = await payload.login({
      collection: 'company-users',
      data: { email, password: PASSWORD },
    })
    const { user: signedIn } = await payload.auth({
      headers: new Headers({ authorization: `JWT ${token}` }),
    })
    if (!signedIn) throw new Error(`could not sign in ${email}`)
    return signedIn
  }
  return {
    alpha,
    beta,
    alphaOwner: await account(`owner@${tag}-alpha.example`, alpha.id, 'owner'),
    alphaViewer: await account(`viewer@${tag}-alpha.example`, alpha.id, 'viewer'),
    betaOwner: await account(`owner@${tag}-beta.example`, beta.id, 'owner'),
    skus,
  }
}
