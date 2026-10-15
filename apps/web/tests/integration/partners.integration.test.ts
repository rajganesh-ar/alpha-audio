import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  partnerAccount,
  partnerCatalogue,
  partnerCookie,
  signInPartner,
  signOutPartner,
} from '@alpha/payload'
import { staff } from './helpers/ledger'
import { seedPurchasing } from './helpers/purchasing'
import { usePayload } from './helpers/suite'
import { seedTrade, type TradeFixture } from './helpers/trade'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

/**
 * Task 0014: the dealer board catalogue (own prices, RRP, trace, stock per visibility, the sale
 * rule) and dealer sign-in and sign-out through Payload's auth.
 */
const payload = usePayload()
let t: TradeFixture
const PASSWORD = 'partners-password-123'

const serialise = (value: unknown) =>
  JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))

async function companyUser(email: string, company: number, locale: 'en' | 'ar' = 'en') {
  await payload().create({
    collection: 'company-users',
    data: { email, password: PASSWORD, company, role: 'purchaser', locale },
    user: await staff(payload()),
    overrideAccess: false,
  })
}

beforeAll(async () => {
  t = await seedTrade(payload(), 'pc')
  const user = await staff(payload())
  const ctx = { user, overrideAccess: false, context: { disableRevalidate: true } } as const
  const brand = await payload().find({
    collection: 'brands',
    where: { slug: { equals: 'pc-brand' } },
    ...ctx,
  })
  // Unpublished in the UAE: never in the catalogue.
  await payload().create({
    collection: 'products',
    data: {
      title: 'PC-HIDDEN title',
      slug: 'pc-hidden',
      sku: 'PC-HIDDEN',
      brand: brand.docs[0]?.id as number,
      markets: [{ market: 'ae', published: false, rrpInclVat: 99_000 }],
      lifecycle: 'active',
      arabicReview: 'draft',
      _status: 'published',
    },
    ...ctx,
  })
  // On sale, none in stock, an open purchase order due on 2 November.
  await payload().create({
    collection: 'products',
    data: {
      title: 'PC-SOON title',
      slug: 'pc-soon',
      sku: 'PC-SOON',
      brand: brand.docs[0]?.id as number,
      markets: [{ market: 'ae', published: true, rrpInclVat: 210_000 }],
      cost: 100_000,
      lifecycle: 'active',
      arabicReview: 'draft',
      _status: 'published',
    },
    ...ctx,
  })
  await seedPurchasing(payload(), {
    lines: [{ sku: 'PC-SOON', description: 'Soon', qtyOrdered: 4, unitCost: 25_000 }],
  })
})

describe('partner catalogue', () => {
  it('shows a dealer its own prices, the RRP, the trace and exact stock', async () => {
    const page = await partnerCatalogue(payload(), t.alphaOwner, { locale: 'en' })
    expect(page?.company).toMatchObject({ id: t.alpha.id, stockVisibility: 'exact' })
    expect(page?.rows.map((r) => r.sku)).toEqual([t.skus.amp, 'PC-SOON', t.skus.spk])
    const [amp, soon, spk] = page?.rows ?? []
    // Amplifier: the contract price. Speakers: no RRP, landed 3,000.00 ÷ (1 − 25 %) = 4,000.00.
    expect(amp).toMatchObject({
      rrpInclVat: { amount: 1_050_000n, currency: 'AED' },
      line: { status: 'ok', basis: 'contract', unit: { amount: 690_000n } },
      stock: { band: '12', eta: null },
    })
    expect(spk).toMatchObject({
      rrpInclVat: null,
      line: { basis: 'dealer-list', unit: { amount: 400_000n } },
    })
    // Out of stock: the open purchase order's date.
    expect(soon?.stock).toEqual({ band: '0', eta: '2026-11-02T00:00:00.000Z' })
    // The internal steps never leave the server.
    expect(amp?.line.trace.map((s) => s.rule)).toEqual([
      'contract',
      'price-list',
      'dealer-list',
      'group-discount',
      'volume-break',
      'promotion',
    ])
  })

  it('shows another company its own prices for the same products, and no stock when hidden', async () => {
    const page = await partnerCatalogue(payload(), t.betaOwner, { locale: 'en' })
    const [amp, , spk] = page?.rows ?? []
    // Amplifier: 10,500.00 incl. 5 % → 10,000.00 net × 75 % (integrator) − 5 % group = 7,125.00.
    expect(amp).toMatchObject({
      line: { basis: 'dealer-list', unit: { amount: 712_500n } },
      stock: { band: null, eta: null },
    })
    expect(spk).toMatchObject({ line: { basis: 'price-list', unit: { amount: 380_000n } } })
    expect(page?.rows.find((r) => r.sku === 'PC-SOON')?.stock).toEqual({ band: null, eta: null })
  })

  it('never carries cost, rules or another company’s data', async () => {
    const out = serialise(await partnerCatalogue(payload(), t.betaOwner, { locale: 'en' }))
    for (const forbidden of [
      'cost',
      'landed',
      'margin',
      'creditLimit',
      '600000',
      '300000',
      '690000',
      'Alpha Hi-Fi',
      'below floor',
    ])
      expect(out).not.toContain(forbidden)
  })

  it('filters by keyword and pages', async () => {
    const found = await partnerCatalogue(payload(), t.alphaOwner, { locale: 'en', q: 'spk' })
    expect(found?.rows.map((r) => r.sku)).toEqual([t.skus.spk])
    expect(found?.query).toBe('spk')
    const second = await partnerCatalogue(payload(), t.alphaOwner, {
      locale: 'en',
      page: 2,
      perPage: 2,
    })
    expect(second).toMatchObject({ page: 2, pages: 2, total: 3 })
    expect(second?.rows.map((r) => r.sku)).toEqual([t.skus.spk])
    expect(
      (await partnerCatalogue(payload(), t.alphaOwner, { locale: 'en', q: 'nothing-like-this' }))
        ?.rows,
    ).toEqual([])
  })

  it('gives the header credit and hold only to owners and purchasers', async () => {
    expect(await partnerAccount(payload(), t.alphaOwner)).toMatchObject({
      company: { id: t.alpha.id, market: 'ae', tier: 'standard' },
      creditLimit: { amount: 5_000_000n, currency: 'AED', decimals: 2 },
      hold: false,
      user: { role: 'owner', locale: 'en' },
    })
    expect(await partnerAccount(payload(), t.alphaViewer)).toMatchObject({
      creditLimit: null,
      hold: null,
      user: { role: 'viewer' },
    })
    expect(await partnerAccount(payload(), await staff(payload()))).toBeNull()
  })

  it('is null for anyone who is not a company user', async () => {
    expect(await partnerCatalogue(payload(), null, { locale: 'en' })).toBeNull()
    expect(await partnerCatalogue(payload(), await staff(payload()), { locale: 'en' })).toBeNull()
  })
})

describe('dealer sign-in', () => {
  it('signs a company user in with a session cookie, and signing out ends the session', async () => {
    await companyUser('Buyer@PC-Alpha.example', t.alpha.id, 'ar')
    const result = await signInPartner(payload(), {
      email: ' buyer@pc-alpha.example ',
      password: PASSWORD,
    })
    if (!result.ok) throw new Error(`sign-in failed: ${result.reason}`)
    expect(result.locale).toBe('ar')
    const cookie = partnerCookie(payload(), result, true)
    expect(cookie).toMatch(
      /^payload-token=[\w.-]+; Path=\/; Expires=.+; HttpOnly; SameSite=Lax; Secure$/,
    )
    // Browsers send Sec-Fetch-Site; Payload refuses a cookie without it or an allowed Origin.
    const headers = new Headers({
      cookie: cookie.split(';')[0] ?? '',
      'sec-fetch-site': 'same-origin',
    })
    const { user } = await payload().auth({ headers })
    expect(user).toMatchObject({ collection: 'company-users', email: 'buyer@pc-alpha.example' })

    await signOutPartner(payload(), user)
    expect((await payload().auth({ headers })).user).toBeNull()
    expect(partnerCookie(payload(), null, false)).toBe(
      'payload-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    )
  })

  it('refuses wrong details, staff accounts and empty input alike', async () => {
    expect(
      await signInPartner(payload(), { email: 'buyer@pc-alpha.example', password: 'wrong-one' }),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(
      await signInPartner(payload(), { email: 'nobody@pc.example', password: PASSWORD }),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(
      await signInPartner(payload(), {
        email: 'ops@alpha.test',
        password: 'integration-password-1',
      }),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(await signInPartner(payload(), { email: '', password: PASSWORD })).toEqual({
      ok: false,
      reason: 'missing',
    })
    expect(await signInPartner(payload(), { email: ['x'], password: 1 })).toEqual({
      ok: false,
      reason: 'missing',
    })
  })

  it('locks an account after five failures, even with the right password', async () => {
    await companyUser('locked@pc-beta.example', t.beta.id)
    for (let i = 0; i < 5; i++)
      await signInPartner(payload(), { email: 'locked@pc-beta.example', password: 'nope-nope' })
    expect(
      await signInPartner(payload(), { email: 'locked@pc-beta.example', password: PASSWORD }),
    ).toEqual({ ok: false, reason: 'locked' })
  })
})
