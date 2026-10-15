import { describe, expect, it } from 'vitest'
import type { RightsWindow } from '@alpha/payload'
import type { Product } from '@/payload-types'
import { saleRule } from './saleRule'

const product = (brand: number, markets: Product['markets']) =>
  ({ id: brand, brand, markets }) as unknown as Product
const windows: RightsWindow[] = [
  { brand: '1', market: 'ae', from: '2024-01-01T00:00:00.000Z', to: null },
  { brand: '2', market: 'ae', from: null, to: '2026-06-30T00:00:00.000Z' },
  { brand: '3', market: 'sa', from: null, to: null },
]

describe('saleRule', () => {
  const onSale = saleRule(windows, new Date('2026-10-15T00:00:00Z'))
  it('needs publication in the market and live brand rights there', () => {
    expect(onSale(product(1, [{ market: 'ae', published: true }]), 'ae')).toBe(true)
    expect(onSale(product(1, [{ market: 'ae', published: false }]), 'ae')).toBe(false)
    expect(onSale(product(2, [{ market: 'ae', published: true }]), 'ae')).toBe(false) // agreement ended
    expect(onSale(product(3, [{ market: 'ae', published: true }]), 'ae')).toBe(false) // rights in sa only
    expect(onSale(product(3, [{ market: 'sa', published: true }]), 'sa')).toBe(true)
    expect(
      onSale(
        {
          ...product(1, [{ market: 'ae', published: true }]),
          brand: { id: 1 },
        } as unknown as Product,
        'ae',
      ),
    ).toBe(true)
  })
  it('respects the start of a window', () => {
    expect(
      saleRule(windows, new Date('2023-12-31T00:00:00Z'))(
        product(1, [{ market: 'ae', published: true }]),
        'ae',
      ),
    ).toBe(false)
  })
})
