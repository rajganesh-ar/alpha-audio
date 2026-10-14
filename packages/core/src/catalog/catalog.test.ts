import { describe, expect, it } from 'vitest'
import { money } from '../money'
import { consumerPrice, publishedIn, schemaAvailability, stockPromise } from '.'

const ae = { code: 'ae', currency: 'AED', decimals: 2, vatRate: 5 } as const
const kw = { code: 'kw', currency: 'KWD', decimals: 3, vatRate: 0 } as const

describe('consumerPrice', () => {
  const entries = [
    { market: 'ae', published: true, rrpInclVat: 5_750_000, priceDisplay: 'show' as const },
    { market: 'kw', published: true, rrpInclVat: 1_250_500 },
    { market: 'sa', published: false, rrpInclVat: 6_000_000 },
  ]

  it('prices incl. VAT with the VAT share from the platform rounding rule', () => {
    expect(consumerPrice({ market: ae, entries })).toEqual({
      kind: 'priced',
      price: money(5_750_000, 'AED', 2),
      vat: money(273_810, 'AED', 2),
      vatRate: 5,
    })
    expect(consumerPrice({ market: kw, entries })).toMatchObject({
      kind: 'priced',
      price: money(1_250_500, 'KWD', 3),
      vat: money(0, 'KWD', 3),
    })
  })

  it('is unavailable where the product is not published or not listed', () => {
    expect(consumerPrice({ market: { ...ae, code: 'sa' }, entries }).kind).toBe('unavailable')
    expect(consumerPrice({ market: { ...ae, code: 'qa' }, entries }).kind).toBe('unavailable')
    expect(consumerPrice({ market: ae, entries: undefined }).kind).toBe('unavailable')
  })

  it('is on request by brand policy, product setting, or a missing price', () => {
    expect(consumerPrice({ market: ae, entries, brandPriceDisplay: 'request' }).kind).toBe(
      'request',
    )
    expect(
      consumerPrice({
        market: ae,
        entries: [{ market: 'ae', published: true, rrpInclVat: 100, priceDisplay: 'request' }],
      }).kind,
    ).toBe('request')
    for (const rrpInclVat of [null, undefined, 0, -5, 10.5]) {
      expect(
        consumerPrice({ market: ae, entries: [{ market: 'ae', published: true, rrpInclVat }] })
          .kind,
      ).toBe('request')
    }
  })

  it('publishedIn', () => {
    expect(publishedIn(entries, 'ae')).toBe(true)
    expect(publishedIn(entries, 'sa')).toBe(false)
    expect(publishedIn(null, 'ae')).toBe(false)
  })
})

describe('stockPromise', () => {
  const now = new Date('2026-10-15T00:00:00Z')
  it('maps sellable units and ETAs to a status', () => {
    expect(stockPromise({ sellable: 5, now })).toEqual({ status: 'in-stock', units: 5, eta: null })
    expect(stockPromise({ sellable: 3, now })).toMatchObject({ status: 'in-stock' })
    expect(stockPromise({ sellable: 2, now })).toMatchObject({ status: 'low', units: 2 })
    expect(stockPromise({ sellable: 1, now, lowUnits: 0 })).toMatchObject({ status: 'in-stock' })
    expect(stockPromise({ sellable: 0, now })).toEqual({ status: 'out', units: 0, eta: null })
    expect(stockPromise({ sellable: -1, now })).toMatchObject({ status: 'out', units: 0 })
    const eta = new Date('2026-11-02T00:00:00Z')
    expect(stockPromise({ sellable: 0, eta, now })).toEqual({ status: 'on-order', units: 0, eta })
    expect(stockPromise({ sellable: 0, eta: new Date('2026-10-01T00:00:00Z'), now })).toEqual({
      status: 'on-order',
      units: 0,
      eta: null,
    })
    expect(stockPromise({ sellable: 4, eta, now }).eta).toBeNull()
    expect(stockPromise({ sellable: 0, eta: new Date(Date.now() + 86_400_000) }).eta).not.toBeNull()
  })

  it('maps to schema.org availability', () => {
    expect(schemaAvailability('in-stock')).toBe('https://schema.org/InStock')
    expect(schemaAvailability('low')).toBe('https://schema.org/LimitedAvailability')
    expect(schemaAvailability('on-order')).toBe('https://schema.org/BackOrder')
    expect(schemaAvailability('out')).toBe('https://schema.org/OutOfStock')
  })
})
