import { describe, expect, it } from 'vitest'
import { money } from '../money'
import { MAX_BAG_LINES, MAX_LINE_QTY, priceBag, updateBag, type CatalogEntry } from './pricing'

const ae = { code: 'ae', currency: 'AED', decimals: 2, vatRate: 5 } as const
const kw = { code: 'kw', currency: 'KWD', decimals: 3, vatRate: 0 } as const
const priced = (amount: number, m: typeof ae | typeof kw = ae) =>
  ({
    kind: 'priced',
    price: money(amount, m.currency, m.decimals),
    vat: money(0, m.currency, m.decimals),
    vatRate: m.vatRate,
  }) as const

const CATALOG: Record<string, CatalogEntry> = {
  A: { sku: 'A', productId: 1, title: 'Amp', price: priced(3_450_000), onSale: true },
  B: { sku: 'B', productId: 2, title: 'Node', price: priced(239_900), onSale: true },
  R: { sku: 'R', productId: 3, title: 'Nova', price: { kind: 'request' }, onSale: true },
  H: { sku: 'H', productId: 4, title: 'Hidden', price: priced(100), onSale: false },
}
const lookup = (sku: string) => CATALOG[sku]

describe('priceBag', () => {
  it('prices lines from the catalogue with VAT per line, summed', () => {
    const bag = priceBag(
      [
        { sku: 'A', qty: 2 },
        { sku: 'B', qty: 1 },
      ],
      lookup,
      ae,
    )
    expect(bag.problems).toEqual([])
    expect(bag.lines.map((l) => [l.sku, l.lineTotal.amount, l.vat.amount])).toEqual([
      ['A', 6_900_000n, 328_571n],
      ['B', 239_900n, 11_424n],
    ])
    expect(bag.totals).toEqual({
      subtotal: money(7_139_900, 'AED', 2),
      vat: money(339_995, 'AED', 2),
      delivery: money(0, 'AED', 2),
      total: money(7_139_900, 'AED', 2),
    })
    // Summed per line, never computed on the total: two AED 0.10 lines carry 0 VAT each (0.476
    // rounds down), while 5% of their AED 0.20 total would be 0.01.
    const tiny = priceBag(
      [
        { sku: 'T1', qty: 1 },
        { sku: 'T2', qty: 1 },
      ],
      (s) => ({ sku: s, productId: s, title: s, price: priced(10), onSale: true }),
      ae,
    )
    expect(tiny.lines.map((l) => l.vat.amount)).toEqual([0n, 0n])
    expect(tiny.totals.vat.amount).toBe(0n)
  })

  it('reports lines that cannot be bought instead of pricing them', () => {
    const bag = priceBag(
      [
        { sku: 'R', qty: 1 },
        { sku: 'H', qty: 1 },
        { sku: 'X', qty: 1 },
        { sku: 'A', qty: 0 },
        { sku: 'A', qty: MAX_LINE_QTY + 1 },
        { sku: 'A', qty: 1.5 },
      ],
      lookup,
      ae,
    )
    expect(bag.lines).toEqual([])
    expect(bag.problems.map((p) => p.problem)).toEqual([
      'price-on-request',
      'not-on-sale',
      'not-on-sale',
      'invalid-quantity',
      'invalid-quantity',
      'invalid-quantity',
    ])
    expect(bag.totals.total).toEqual(money(0, 'AED', 2))
  })

  it('keeps three-decimal currencies exact', () => {
    const bag = priceBag(
      [{ sku: 'K', qty: 3 }],
      () => ({ sku: 'K', productId: 9, title: 'K', price: priced(1_250_500, kw), onSale: true }),
      kw,
    )
    expect(bag.totals.total).toEqual(money(3_751_500, 'KWD', 3))
    expect(bag.totals.vat.amount).toBe(0n)
  })
})

describe('updateBag', () => {
  it('adds, merges, sets, removes and caps', () => {
    let bag = updateBag([], { sku: 'A', qty: 1, mode: 'add' })
    bag = updateBag(bag, { sku: 'A', qty: 2, mode: 'add' })
    bag = updateBag(bag, { sku: 'B', qty: 1, mode: 'add' })
    expect(bag).toEqual([
      { sku: 'A', qty: 3 },
      { sku: 'B', qty: 1 },
    ])
    expect(updateBag(bag, { sku: 'A', qty: 99, mode: 'set' })).toEqual([
      { sku: 'A', qty: MAX_LINE_QTY },
      { sku: 'B', qty: 1 },
    ])
    expect(updateBag(bag, { sku: 'A', qty: 0, mode: 'set' })).toEqual([{ sku: 'B', qty: 1 }])
    const full = Array.from({ length: MAX_BAG_LINES }, (_, i) => ({ sku: `S${i}`, qty: 1 }))
    expect(updateBag(full, { sku: 'NEW', qty: 1, mode: 'add' })).toEqual(full)
    expect(updateBag(full, { sku: 'S0', qty: 2, mode: 'set' })[0]).toEqual({ sku: 'S0', qty: 2 })
  })
})
