import { describe, expect, it } from 'vitest'
import { money } from '../money'
import { minimumRrp, resolvePrices, stockBand } from './resolve'
import type { PriceContext, PricingData, PricingProduct } from './types'

const ctx: PriceContext = {
  company: 1,
  market: 'ae',
  currency: 'AED',
  decimals: 2,
  vatRate: 5,
  channel: 'dealer',
  at: new Date('2026-10-15T10:00:00Z'),
}
const product = (sku: string, patch: Partial<PricingProduct> = {}): PricingProduct => ({
  sku,
  brand: 'mcintosh',
  categories: ['amplifiers'],
  rrpInclVat: 1_050_000n, // AED 10,500.00 incl. 5 % → 10,000.00 net
  landedCostAed: 600_000n, // AED 6,000.00
  onSale: true,
  ...patch,
})
const data = (patch: Partial<PricingData> = {}): PricingData => ({
  products: new Map(
    [
      product('AMP'),
      product('SPK', {
        brand: 'sonus',
        categories: ['speakers'],
        rrpInclVat: null,
        landedCostAed: 300_000n,
      }),
      product('SUB', { brand: 'sonus', categories: ['speakers'] }),
      product('NOSALE', { onSale: false }),
      product('NOPRICE', { rrpInclVat: null, landedCostAed: null }),
    ].map((p) => [p.sku, p]),
  ),
  contracts: [],
  priceList: null,
  groupDiscounts: [],
  rules: [],
  settings: {
    channelFactorBps: { dealer: 7_000, integrator: 7_500, retailer: 8_000 },
    targetMarginBps: 2_500,
    marginFloorBps: 1_000,
    fxAedMicros: { SAR: 979_000n, KWD: 11_950_000n },
  },
  ...patch,
})
const one = (sku: string, d = data(), qty = 1, c = ctx) =>
  resolvePrices(c, [{ sku, qty }], d).lines[0]
const unit = (sku: string, d = data(), qty = 1, c = ctx) => one(sku, d, qty, c)?.unit?.amount
const rule = {
  validFrom: null,
  validTo: null,
  sku: null,
  brand: null,
  minQty: 1,
  stackable: false,
  markets: [] as string[],
}

describe('resolvePrices', () => {
  it('lists at RRP excl. VAT × channel factor, or landed cost ÷ (1 − target margin) without an RRP', () => {
    expect(unit('AMP')).toBe(700_000n) // 10,000.00 × 70 %
    expect(unit('AMP', data(), 1, { ...ctx, channel: 'retailer' })).toBe(800_000n)
    expect(unit('SPK')).toBe(400_000n) // 3,000.00 ÷ 0.75
    expect(one('AMP')).toMatchObject({
      status: 'ok',
      basis: 'dealer-list',
      total: money(700_000n, 'AED', 2),
      vat: money(35_000n, 'AED', 2),
    })
  })

  it('takes a live contract first, then the price list, ignoring expired ones', () => {
    const contracts = [
      { sku: 'AMP', price: 690_000n, validFrom: null, validTo: null },
      { sku: 'AMP', price: 500_000n, validFrom: null, validTo: new Date('2026-01-01') },
    ]
    expect(one('AMP', data({ contracts }))).toMatchObject({
      basis: 'contract',
      unit: { amount: 690_000n },
    })
    const priceList = { items: [{ sku: 'SUB', price: 250_000n }], validFrom: null, validTo: null }
    expect(one('SUB', data({ priceList }))).toMatchObject({
      basis: 'price-list',
      unit: { amount: 250_000n },
      status: 'needs-approval',
    })
    expect(
      one('SUB', data({ priceList: { ...priceList, validFrom: new Date('2027-01-01') } })),
    ).toMatchObject({ basis: 'dealer-list' })
  })

  it('discounts a list price by group (brand, then category, then all) and by volume, best break wins', () => {
    const groupDiscounts = [
      { brand: null, category: null, bps: 100 },
      { brand: null, category: 'amplifiers', bps: 200 },
      { brand: 'mcintosh', category: null, bps: 300 },
    ]
    expect(unit('AMP', data({ groupDiscounts }))).toBe(679_000n) // 700,000 × 0.97
    expect(unit('SUB', data({ groupDiscounts }))).toBe(693_000n) // all-products 1 %
    const rules = [
      { ...rule, kind: 'volume' as const, brand: 'mcintosh', minQty: 3, bps: 300 },
      { ...rule, kind: 'volume' as const, sku: 'AMP', minQty: 5, bps: 500 },
    ]
    expect(unit('AMP', data({ rules }), 2)).toBe(700_000n)
    expect(unit('AMP', data({ rules }), 3)).toBe(679_000n)
    expect(unit('AMP', data({ rules }), 6)).toBe(665_000n)
    expect(one('AMP', data({ rules }), 6)).toMatchObject({ status: 'needs-approval' })
  })

  it('applies a stackable promotion to any base and a plain one only to list prices', () => {
    const contracts = [{ sku: 'AMP', price: 800_000n, validFrom: null, validTo: null }]
    const stack = { ...rule, kind: 'promotion' as const, stackable: true, bps: 200 }
    const plain = { ...rule, kind: 'promotion' as const, bps: 1_000 }
    expect(unit('AMP', data({ contracts, rules: [stack] }))).toBe(784_000n)
    expect(unit('AMP', data({ contracts, rules: [plain] }))).toBe(800_000n)
    expect(unit('SPK', data({ rules: [plain] }))).toBe(360_000n)
    expect(unit('SPK', data({ rules: [{ ...plain, markets: ['sa'] }] }))).toBe(400_000n)
  })

  it('needs approval below landed cost ÷ (1 − floor)', () => {
    // floor = 6,000.00 ÷ 0.9 = 6,666.67
    const groupDiscounts = [{ brand: 'mcintosh', category: null, bps: 500 }]
    const line = one('AMP', data({ groupDiscounts }))
    expect(line).toMatchObject({ status: 'needs-approval', unit: { amount: 665_000n } })
    expect(line?.trace.find((s) => s.rule === 'margin-floor')).toEqual({
      rule: 'margin-floor',
      seen: true,
      matched: true,
      value: 'below floor',
    })
  })

  it('refuses what the company cannot buy', () => {
    for (const sku of ['NOSALE', 'NOPRICE', 'MISSING'])
      expect(one(sku)).toMatchObject({ status: 'unavailable', unit: null })
    expect(one('AMP', data(), 0)).toMatchObject({ status: 'unavailable' })
  })

  it('explains every line', () => {
    const groupDiscounts = [{ brand: 'mcintosh', category: null, bps: 300 }]
    expect(one('AMP', data({ groupDiscounts }))?.trace).toEqual([
      { rule: 'contract', seen: true, matched: false, value: null },
      { rule: 'project', seen: true, matched: false, value: null },
      { rule: 'price-list', seen: true, matched: false, value: null },
      { rule: 'dealer-list', seen: true, matched: true, value: '7000.00' },
      { rule: 'group-discount', seen: true, matched: true, value: '-3%' },
      { rule: 'volume-break', seen: true, matched: false, value: null },
      { rule: 'promotion', seen: true, matched: false, value: null },
      { rule: 'margin-floor', seen: true, matched: false, value: null },
    ])
    const contracts = [{ sku: 'AMP', price: 690_000n, validFrom: null, validTo: null }]
    const trace = one('AMP', data({ contracts }))?.trace ?? []
    expect(trace.filter((s) => s.seen).map((s) => s.rule)).toEqual([
      'contract',
      'promotion',
      'margin-floor',
    ])
  })

  it('works in 3-decimal currencies at the FX rate, and totals the lines', () => {
    const kw: PriceContext = { ...ctx, market: 'kw', currency: 'KWD', decimals: 3, vatRate: 0 }
    const products = new Map([['AMP', product('AMP', { rrpInclVat: 300_000n })]]) // KWD 300.000
    const line = one('AMP', data({ products }), 2, kw)
    // list 210.000; floor = AED 6,000 ÷ 11.95 = KWD 502.092 ÷ 0.9 = 557.880 → needs approval
    expect(line).toMatchObject({
      unit: money(210_000n, 'KWD', 3),
      total: money(420_000n, 'KWD', 3),
      vat: money(0n, 'KWD', 3),
      status: 'needs-approval',
    })
    const sa: PriceContext = { ...ctx, market: 'sa', currency: 'SAR', vatRate: 15 }
    const result = resolvePrices(
      sa,
      [
        { sku: 'AMP', qty: 1 },
        { sku: 'SPK', qty: 2 },
        { sku: 'NOSALE', qty: 1 },
      ],
      data({
        products: new Map([
          ['AMP', product('AMP', { rrpInclVat: 1_150_000n })],
          ['SPK', product('SPK', { rrpInclVat: null, landedCostAed: 300_000n })],
          ['NOSALE', product('NOSALE', { onSale: false })],
        ]),
      }),
    )
    // AMP: 10,000.00 net × 70 % = 7,000.00; SPK: AED 3,000 = SAR 3,064.35 ÷ 0.75 = 4,085.80
    expect(result.lines.map((l) => l.unit?.amount ?? null)).toEqual([700_000n, 408_580n, null])
    expect(result.totals).toEqual({
      net: money(1_517_160n, 'SAR', 2),
      vat: money(105_000n + 122_574n, 'SAR', 2),
      gross: money(1_517_160n + 227_574n, 'SAR', 2),
    })
  })

  it('leaves a currency without an FX rate unchecked against the floor', () => {
    const om: PriceContext = { ...ctx, market: 'om', currency: 'OMR', decimals: 3 }
    const line = one('AMP', data(), 1, om)
    expect(line?.trace.find((s) => s.rule === 'margin-floor')?.seen).toBe(false)
    expect(line?.status).toBe('ok')
  })
})

describe('stockBand', () => {
  it('shows exact, banded or nothing', () => {
    expect(stockBand(7, 'exact')).toBe('7')
    expect(stockBand(-2, 'exact')).toBe('0')
    expect([12, 10, 9, 3, 2, 1, 0].map((n) => stockBand(n, 'banded'))).toEqual([
      '10+',
      '10+',
      '3–9',
      '3–9',
      'Low',
      'Low',
      '0',
    ])
    expect(stockBand(50, 'hidden')).toBeNull()
  })
})

describe('minimumRrp', () => {
  it('is MAP plus VAT on it', () => {
    expect(minimumRrp(1_000_000n, 5)).toBe(1_050_000n)
    expect(minimumRrp(33_33n, 15)).toBe(3_833n)
    expect(minimumRrp(12_345n, 0)).toBe(12_345n)
  })
})
