import { describe, expect, it } from 'vitest'
import { money } from '@alpha/core'
import type { PartnerCatalogueRow } from '@alpha/payload'
import { getDictionary, translator } from '@alpha/ui'
import { catalogueView, stockText, traceValue, type ViewContext } from './catalogueView'

const ctx = (locale: 'en' | 'ar' = 'en'): ViewContext => ({
  t: translator(getDictionary(locale)),
  locale: `${locale}-AE-u-nu-latn`,
  timezone: 'Asia/Dubai',
  currency: 'AED',
  decimals: 2,
  channel: 'integrator',
})
const aed = (n: bigint) => money(n, 'AED', 2)
/** Intl puts a no-break space between the currency and the amount. */
const plain = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value ?? null).replace(/\\u00a0|\u00a0/g, ' ')) as T

const row: PartnerCatalogueRow = {
  id: 1,
  sku: 'AMP',
  slug: 'amp',
  title: 'Amplifier',
  brand: 'Lumen',
  rrpInclVat: aed(1_050_000n),
  line: {
    sku: 'AMP',
    qty: 1,
    status: 'ok',
    unit: aed(712_500n),
    total: aed(712_500n),
    vat: aed(35_625n),
    basis: 'dealer-list',
    trace: [
      { rule: 'contract', seen: true, matched: false, value: null },
      { rule: 'price-list', seen: true, matched: false, value: null },
      { rule: 'dealer-list', seen: true, matched: true, value: '7500.00' },
      { rule: 'group-discount', seen: true, matched: true, value: '-5%' },
      { rule: 'volume-break', seen: false, matched: false, value: null },
    ],
  },
  stock: { band: '3–9', eta: null },
}

describe('catalogueView', () => {
  it('formats prices and the trace from the service figures', () => {
    const [view] = plain(catalogueView([row], ctx()))
    expect(view?.row).toMatchObject({
      rrp: 'AED 10,500.00',
      price: 'AED 7,125.00',
      status: 'ok',
      stock: '3–9',
      brand: 'Lumen',
    })
    expect(view?.trace).toEqual([
      { label: 'Your contract price', value: undefined, state: 'checked' },
      { label: 'Your price list', value: undefined, state: 'checked' },
      { label: 'Dealer list (integrator)', value: 'AED 7,500.00', state: 'applied' },
      { label: 'Group discount', value: '−5%', state: 'applied' },
      { label: 'Volume break', value: undefined, state: 'skipped' },
    ])
  })

  it('keeps Western digits in Arabic', () => {
    const [view] = catalogueView([row], ctx('ar'))
    expect(view?.row.price).toMatch(/7,125\.00/)
    expect(view?.trace[2]?.label).toBe('قائمة الوكلاء (مُكامل)')
  })

  it('shows no trace for an unavailable product, and 3-decimal base prices', () => {
    const [view] = catalogueView(
      [{ ...row, rrpInclVat: null, line: { ...row.line, status: 'unavailable', unit: null } }],
      ctx(),
    )
    expect(view?.row).toMatchObject({ rrp: undefined, price: undefined, status: 'unavailable' })
    expect(view?.trace).toEqual([])
    expect(
      plain(
        traceValue(
          { rule: 'contract', seen: true, matched: true, value: '12.345' },
          { ...ctx(), currency: 'KWD', decimals: 3 },
        ),
      ),
    ).toBe('KWD 12.345')
    expect(
      plain(traceValue({ rule: 'project', seen: true, matched: true, value: '4500.00' }, ctx())),
    ).toBe('AED 4,500.00')
  })

  it('words stock: band, low, out of stock with or without a date, hidden', () => {
    expect(stockText({ band: 'Low', eta: null }, ctx())).toBe('Low')
    expect(stockText({ band: '0', eta: null }, ctx())).toBe('Out of stock')
    expect(stockText({ band: '0', eta: '2026-11-02T00:00:00.000Z' }, ctx())).toBe(
      'Expected 2 Nov 2026',
    )
    expect(stockText({ band: '12', eta: null }, ctx())).toBe('12')
    expect(stockText({ band: null, eta: null }, ctx())).toBeUndefined()
  })
})
