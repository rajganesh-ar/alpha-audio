import { describe, expect, it } from 'vitest'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { createLedger } from '@alpha/payload'
import { db, seedInventory, staff } from './helpers/ledger'
import { seedPurchasing } from './helpers/purchasing'
import { usePayload } from './helpers/suite'

const payload = usePayload()

type Refusal = Error & { status?: number }
async function refusal(action: Promise<unknown>): Promise<Refusal> {
  try {
    await action
  } catch (error) {
    return error as Refusal
  }
  throw new Error('expected the operation to be refused')
}

let n = 0
async function catalogue(
  options: {
    publish?: boolean
    markets?: Array<{ market: 'ae' | 'sa'; published: boolean; rrpInclVat?: number }>
  } = {},
) {
  const user = await staff(payload())
  const as = { user, overrideAccess: false } as const
  const i = ++n
  const status = options.publish === false ? 'draft' : 'published'
  const brand = await payload().create({
    collection: 'brands',
    data: {
      name: `Brand ${i}`,
      slug: `brand-${i}`,
      priceDisplay: 'show',
      arabicReview: 'draft',
      _status: 'published',
    },
    ...as,
  })
  const product = await payload().create({
    collection: 'products',
    data: {
      title: `Product ${i}`,
      slug: `brand-${i}-model`,
      sku: `CAT-SKU-${i}`,
      brand: brand.id,
      cost: 123_400,
      lifecycle: 'active',
      arabicReview: 'draft',
      markets: options.markets ?? [{ market: 'ae', published: true, rrpInclVat: 1_000_000 }],
      _status: status,
    },
    draft: status === 'draft',
    ...as,
  })
  return { brand, product }
}

describe('catalogue access', () => {
  it('anonymous readers see published products only, never cost; staff see drafts and cost', async () => {
    const { product } = await catalogue()
    const { product: draft } = await catalogue({ publish: false })
    const anonymous = await payload().find({
      collection: 'products',
      where: { id: { in: [product.id, draft.id] } },
      overrideAccess: false,
    })
    expect(anonymous.docs.map((d) => d.id)).toEqual([product.id])
    expect(anonymous.docs[0]).not.toHaveProperty('cost')

    const user = await staff(payload())
    const asStaff = await payload().find({
      collection: 'products',
      where: { id: { in: [product.id, draft.id] } },
      user,
      overrideAccess: false,
      draft: true,
    })
    expect(asStaff.docs.map((d) => d.id).sort()).toEqual([product.id, draft.id].sort())
    expect(asStaff.docs.find((d) => d.id === product.id)?.cost).toBe(123_400)
  })

  it('anonymous visitors cannot create or edit catalogue documents; nobody deletes', async () => {
    const { product, brand } = await catalogue()
    expect(
      (
        await refusal(
          payload().create({
            collection: 'brands',
            data: { name: 'X', slug: 'x-anon', priceDisplay: 'show', arabicReview: 'draft' },
            overrideAccess: false,
          }),
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await refusal(
          payload().update({
            collection: 'products',
            id: product.id,
            data: { title: 'Hacked' },
            overrideAccess: false,
          }),
        )
      ).status,
    ).toBe(403)
    const user = await staff(payload())
    expect(
      (
        await refusal(
          payload().delete({ collection: 'brands', id: brand.id, user, overrideAccess: false }),
        )
      ).status,
    ).toBe(403)
  })

  it('a draft edit does not change what the storefront reads until it is published', async () => {
    const { product } = await catalogue()
    const user = await staff(payload())
    await payload().update({
      collection: 'products',
      id: product.id,
      data: { title: 'Renamed in draft' },
      draft: true,
      user,
      overrideAccess: false,
    })
    expect(
      (await payload().findByID({ collection: 'products', id: product.id, overrideAccess: false }))
        .title,
    ).toBe(product.title)
    await payload().update({
      collection: 'products',
      id: product.id,
      data: { title: 'Renamed', _status: 'published' },
      user,
      overrideAccess: false,
    })
    expect(
      (await payload().findByID({ collection: 'products', id: product.id, overrideAccess: false }))
        .title,
    ).toBe('Renamed')
  })

  it('the Home global is public, and anonymous readers get the published version', async () => {
    const user = await staff(payload())
    await payload().updateGlobal({
      slug: 'home',
      data: { hero: { headline: 'Published headline' }, _status: 'published' },
      user,
      overrideAccess: false,
    })
    await payload().updateGlobal({
      slug: 'home',
      data: { hero: { headline: 'Draft headline' } },
      draft: true,
      user,
      overrideAccess: false,
    })
    expect(
      (await payload().findGlobal({ slug: 'home', overrideAccess: false })).hero.headline,
    ).toBe('Published headline')
    expect(
      (
        await refusal(
          payload().updateGlobal({
            slug: 'home',
            data: { hero: { headline: 'x' } },
            overrideAccess: false,
          }),
        )
      ).status,
    ).toBe(403)
  })
})

describe('catalogue rules', () => {
  it('one row per market, and prices are positive minor units', async () => {
    const user = await staff(payload())
    const duplicate = await refusal(
      catalogue({
        markets: [
          { market: 'ae', published: true, rrpInclVat: 100 },
          { market: 'ae', published: false, rrpInclVat: 200 },
        ],
      }),
    )
    expect(duplicate.message).toMatch(/listed twice|invalid/i)
    const { product } = await catalogue()
    await expect(
      db(payload()).execute(
        sql`UPDATE products_markets SET rrp_incl_vat = 10.5 WHERE _parent_id = ${product.id}`,
      ),
    ).rejects.toThrow()
    await expect(
      db(payload()).execute(
        sql`INSERT INTO products_markets (_order, _parent_id, id, market, published) VALUES (9, ${product.id}, 'dup-row', 'ae', true)`,
      ),
    ).rejects.toThrow()
    expect(
      (
        await refusal(
          payload().update({
            collection: 'products',
            id: product.id,
            data: { slug: 'Not A Slug' },
            user,
            overrideAccess: false,
          }),
        )
      ).status,
    ).toBe(400)
  })
})

describe('storefront stock promise', () => {
  it('follows the ledger: in stock, low, on order with the PO date, out', async () => {
    // Imported here: the module loads the Payload config, which needs the env bootPayload sets.
    const { stockPromises } = await import('@/lib/stock')
    const { main } = await seedInventory(payload())
    const ledger = createLedger(payload())
    const doc = { type: 'opening' as const, id: 'OB-CAT' }
    await ledger.move({
      sku: 'STOCK-MANY',
      qty: 5,
      from: null,
      to: 'available',
      location: main,
      doc,
    })
    await ledger.move({
      sku: 'STOCK-FEW',
      qty: 2,
      from: null,
      to: 'available',
      location: main,
      doc,
    })
    await seedPurchasing(payload(), {
      expectedAt: '2099-03-01T00:00:00.000Z',
      lines: [{ sku: 'STOCK-COMING', qtyOrdered: 2, unitCost: 1 }],
    })

    const promises = await stockPromises(
      ['STOCK-MANY', 'STOCK-FEW', 'STOCK-COMING', 'STOCK-NONE'],
      'ae',
    )
    expect(
      Object.fromEntries(
        [...promises].map(([sku, p]) => [sku, [p.status, p.eta?.toISOString() ?? null]]),
      ),
    ).toEqual({
      'STOCK-MANY': ['in-stock', null],
      'STOCK-FEW': ['low', null],
      'STOCK-COMING': ['on-order', '2099-03-01T00:00:00.000Z'],
      'STOCK-NONE': ['out', null],
    })

    // A reservation is a ledger change: the next promise reflects it, no rebuild involved.
    await ledger.reserve({
      sku: 'STOCK-MANY',
      qty: 4,
      market: 'ae',
      doc: { type: 'quote', id: 'Q-CAT' },
    })
    expect((await stockPromises(['STOCK-MANY'], 'ae')).get('STOCK-MANY')?.status).toBe('low')
  })
})
