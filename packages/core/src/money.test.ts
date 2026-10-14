import { describe, expect, it } from 'vitest'
import { formatMoney, money, toDecimalString } from './money'

/** Arabic-Indic (U+0660–0669) and Extended Arabic-Indic (U+06F0–06F9) digits. */
const ARABIC_INDIC_DIGITS = new RegExp('[\\u0660-\\u0669\\u06F0-\\u06F9]')

/** Intl joins the code and amount with a no-break space so they never wrap apart. */
const NBSP = String.fromCharCode(0xa0)

describe('formatMoney', () => {
  it('formats AED with 2 decimals in English', () => {
    expect(formatMoney(money(57_500_00, 'AED', 2), 'en-AE')).toBe(`AED${NBSP}57,500.00`)
  })

  it('formats KWD with all 3 decimals, keeping a trailing zero', () => {
    expect(formatMoney(money(2_944_750, 'KWD', 3), 'en-KW')).toBe(`KWD${NBSP}2,944.750`)
  })

  it.each(['ar-AE', 'ar-SA', 'ar-KW', 'ar-BH', 'ar-OM', 'ar-QA', 'ar-EG'])(
    'uses Western digits in %s',
    (locale) => {
      const formatted = formatMoney(money(1_234_500, 'SAR', 2), locale)
      expect(formatted).not.toMatch(ARABIC_INDIC_DIGITS)
      expect(formatted).toContain('12,345.00')
    },
  )

  it('keeps 3 decimals in Arabic', () => {
    expect(formatMoney(money(2_944_750, 'KWD', 3), 'ar-KW')).toContain('2,944.750')
  })

  it('formats negative amounts (refunds) without losing the sign', () => {
    expect(formatMoney(money(-12_50, 'AED', 2), 'en-AE')).toBe(`-AED${NBSP}12.50`)
  })

  it('is exact for amounts beyond Number.MAX_SAFE_INTEGER', () => {
    const value = { amount: 9_007_199_254_740_993n, currency: 'AED' as const, decimals: 2 as const }
    expect(formatMoney(value, 'en-AE')).toBe(`AED${NBSP}90,071,992,547,409.93`)
  })
})

describe('money', () => {
  it('rejects non-integer or unsafe numbers', () => {
    expect(() => money(12.5, 'AED', 2)).toThrow(RangeError)
    expect(() => money(2 ** 60, 'AED', 2)).toThrow(RangeError)
  })

  it('accepts bigint directly', () => {
    expect(money(2n ** 60n, 'AED', 2).amount).toBe(2n ** 60n)
  })
})

describe('toDecimalString', () => {
  it.each([
    [273_810n, 2, '2738.10'],
    [5n, 2, '0.05'],
    [-5n, 3, '-0.005'],
    [0n, 3, '0.000'],
    [42n, 0, '42'],
    [-42n, 0, '-42'],
  ])('(%s, %s) → %s', (amount, decimals, expected) => {
    expect(toDecimalString(amount, decimals)).toBe(expected)
  })
})
