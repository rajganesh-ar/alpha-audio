import { beforeAll, describe, expect, it, vi } from 'vitest'
import { resolveForSession } from '@alpha/payload'
import { staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'
import { seedTrade, type TradeFixture } from './helpers/trade'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

/** Task 0013: the price engine over real data (rules, settings, rights) and MAP validation. */
const payload = usePayload()
let t: TradeFixture

beforeAll(async () => {
  t = await seedTrade(payload(), 'tp')
})

describe('trade pricing over Postgres', () => {
  it('applies volume breaks, promotions, the margin floor and settings changes', async () => {
    const user = await staff(payload())
    const ctx = { user, overrideAccess: false } as const
    await payload().create({
      collection: 'price-rules',
      data: { name: 'Speakers × 5', kind: 'volume', sku: t.skus.spk, minQty: 5, bps: 300 },
      ...ctx,
    })
    await payload().create({
      collection: 'price-rules',
      data: {
        name: 'Autumn',
        kind: 'promotion',
        stackable: true,
        minQty: 1,
        bps: 200,
        markets: ['ae'],
      },
      ...ctx,
    })
    const result = await resolveForSession(payload(), t.alphaOwner, [
      { sku: t.skus.spk, qty: 5 },
      { sku: t.skus.amp, qty: 1 },
    ])
    // Speakers: 4,000.00 list −3 % (volume) −2 % (stackable promotion) = 3,802.40
    // Amplifier: contract 6,900.00 −2 % = 6,762.00; floor 6,000 ÷ 0.9 = 6,666.67 → ok
    expect(result?.lines.map((l) => [l.unit?.amount, l.status])).toEqual([
      [380_240n, 'ok'],
      [676_200n, 'ok'],
    ])
    expect(result?.totals.vat.amount).toBe(95_060n + 33_810n)

    await payload().updateGlobal({
      slug: 'pricing-settings',
      data: {
        marginFloor: 2_000,
        channelFactors: { dealer: 7_000, integrator: 7_500, retailer: 8_000 },
      },
      ...ctx,
    })
    const strict = await resolveForSession(payload(), t.alphaOwner, [{ sku: t.skus.amp, qty: 1 }])
    // floor now 6,000 ÷ 0.8 = 7,500.00 > 6,762.00
    expect(strict?.lines[0]?.status).toBe('needs-approval')
  })

  it('refuses an RRP below MAP plus VAT, with the reason', async () => {
    const user = await staff(payload())
    const [product] = (
      await payload().find({
        collection: 'products',
        where: { sku: { equals: t.skus.amp } },
        user,
        overrideAccess: false,
      })
    ).docs
    const save = (rrp: number) =>
      payload().update({
        collection: 'products',
        id: product?.id ?? 0,
        data: {
          markets: [{ market: 'ae', published: true, rrpInclVat: rrp, mapExclVat: 1_000_000 }],
        },
        user,
        overrideAccess: false,
        context: { disableRevalidate: true },
      })
    const refused = await save(1_049_999).catch(
      (error: { data?: { errors?: Array<{ message: string }> } }) => error,
    )
    expect(JSON.stringify((refused as { data?: unknown }).data)).toMatch(
      /at least 10500\.00 AED incl\. 5% VAT/,
    )
    await expect(save(1_050_000)).resolves.toMatchObject({ sku: t.skus.amp })
  })
})
