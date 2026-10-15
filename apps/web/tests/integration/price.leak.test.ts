import { beforeAll, describe, expect, it, vi } from 'vitest'
import { resolveForSession } from '@alpha/payload'
import type { TypedUser } from 'payload'
import { staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'
import { seedTrade, type TradeFixture } from './helpers/trade'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

/**
 * Mandatory test (CLAUDE.md): two companies sign in; neither can read the other's prices, stock
 * setting, credit or users, through the Local API (the same access the REST and GraphQL APIs
 * apply) or through the price service. Quotes join this test when the Quotes collection exists.
 */
const payload = usePayload()
let t: TradeFixture

const as = (user: TypedUser) => ({ user, overrideAccess: false }) as const
async function status(action: Promise<unknown>): Promise<number | 'ok'> {
  try {
    await action
    return 'ok'
  } catch (error) {
    return (error as { status?: number }).status ?? 500
  }
}

beforeAll(async () => {
  t = await seedTrade(payload(), 'leak')
})

describe('two-buyer leak test', () => {
  it('each company reads only itself', async () => {
    for (const [user, own, other] of [
      [t.alphaOwner, t.alpha.id, t.beta.id],
      [t.betaOwner, t.beta.id, t.alpha.id],
    ] as const) {
      const companies = await payload().find({ collection: 'companies', ...as(user) })
      expect(companies.docs.map((c) => c.id)).toEqual([own])
      expect(
        await status(payload().findByID({ collection: 'companies', id: other, ...as(user) })),
      ).toBe(404)
      const where = await payload().find({
        collection: 'companies',
        where: { id: { equals: other } },
        ...as(user),
      })
      expect(where.totalDocs).toBe(0)
    }
  })

  it('never shows another company’s credit or settings, and hides its own from viewers', async () => {
    const own = await payload().findByID({
      collection: 'companies',
      id: t.alpha.id,
      ...as(t.alphaOwner),
    })
    expect(own.creditLimit).toBe(5_000_000)
    expect(own.settings?.stockVisibility).toBe('exact')
    expect(own.buyerGroup).toBeUndefined()
    const viewer = await payload().findByID({
      collection: 'companies',
      id: t.alpha.id,
      ...as(t.alphaViewer),
    })
    expect(viewer.creditLimit).toBeUndefined()
    expect(viewer.settings).toBeUndefined()
    // Filtering on credit is as good as reading it: Payload refuses the query outright.
    expect(
      await status(
        payload().find({
          collection: 'companies',
          where: { creditLimit: { greater_than: 1 } },
          ...as(t.betaOwner),
        }),
      ),
    ).not.toBe('ok')
  })

  it('never shows another company’s users', async () => {
    const colleagues = await payload().find({ collection: 'company-users', ...as(t.alphaOwner) })
    expect(colleagues.docs.map((u) => u.email).sort()).toEqual([
      `owner@leak-alpha.example`,
      `viewer@leak-alpha.example`,
    ])
    const beta = await payload().find({ collection: 'company-users', ...as(t.betaOwner) })
    expect(beta.docs.map((u) => u.email)).toEqual([`owner@leak-beta.example`])
  })

  it('keeps every pricing rule and cost away from companies', async () => {
    for (const collection of [
      'contract-prices',
      'price-lists',
      'buyer-groups',
      'price-rules',
    ] as const) {
      for (const user of [t.alphaOwner, t.betaOwner]) {
        expect(await status(payload().find({ collection, ...as(user) }))).toBe(403)
      }
    }
    expect(
      await status(payload().findGlobal({ slug: 'pricing-settings', ...as(t.alphaOwner) })),
    ).toBe(403)
    const products = await payload().find({
      collection: 'products',
      where: { sku: { equals: t.skus.amp } },
      ...as(t.alphaOwner),
    })
    expect(products.docs[0]?.cost).toBeUndefined()
  })

  it('prices each company from its own rules only', async () => {
    const lines = [
      { sku: t.skus.amp, qty: 1 },
      { sku: t.skus.spk, qty: 1 },
    ]
    const alpha = await resolveForSession(payload(), t.alphaOwner, lines)
    const beta = await resolveForSession(payload(), t.betaOwner, lines)
    // Alpha: its contract on the amplifier; dealer list on the speakers (no RRP: landed ÷ 0.75).
    expect(alpha?.lines.map((l) => [l.basis, l.unit?.amount])).toEqual([
      ['contract', 690_000n],
      ['dealer-list', 400_000n],
    ])
    // Beta: integrator list (75 %) less its group's 5 % on the amplifier; its price list on the speakers.
    expect(beta?.lines.map((l) => [l.basis, l.unit?.amount])).toEqual([
      ['dealer-list', 712_500n],
      ['price-list', 380_000n],
    ])
    const betaTrace = JSON.stringify(
      beta?.lines.map((l) => l.trace),
      (_, v) => (typeof v === 'bigint' ? String(v) : v),
    )
    expect(betaTrace).not.toContain('6900.00')
    expect(alpha?.company.id).toBe(t.alpha.id)
    expect(beta?.company.id).toBe(t.beta.id)
  })

  it('gives no trade price to anyone who is not a company user', async () => {
    expect(await resolveForSession(payload(), null, [{ sku: t.skus.amp, qty: 1 }])).toBeNull()
    expect(
      await resolveForSession(payload(), await staff(payload()), [{ sku: t.skus.amp, qty: 1 }]),
    ).toBeNull()
    // A forged user object naming another company does not come from a session; the service only
    // reads `company` from what Payload resolved, and a staff user has none.
    const forged = { ...(await staff(payload())), company: t.alpha.id }
    expect(await resolveForSession(payload(), forged, [{ sku: t.skus.amp, qty: 1 }])).toBeNull()
  })

  it('lets staff see both companies (staff versus company)', async () => {
    const all = await payload().find({
      collection: 'companies',
      user: await staff(payload()),
      overrideAccess: false,
    })
    expect(all.docs.map((c) => c.id)).toEqual(expect.arrayContaining([t.alpha.id, t.beta.id]))
    expect(all.docs.find((c) => c.id === t.beta.id)?.creditLimit).toBe(2_000_000)
  })
})
