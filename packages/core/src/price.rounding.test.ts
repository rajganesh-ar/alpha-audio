import { describe, expect, it } from 'vitest'
import { divideRoundHalfUp, money, roundToDecimals, vatShare, vatShareOf } from './money'

/**
 * Mandatory test (CLAUDE.md): 2-decimal and 3-decimal currencies, VAT as
 * total × rate ÷ (100 + rate), rounded half-up at the last step.
 */
describe('vatShare', () => {
  it('extracts UAE 5 % VAT from an inclusive total (task 0002 acceptance)', () => {
    // AED 57,500.00 incl. VAT → VAT AED 2,738.10 (5,750,000 × 5 ÷ 105 = 273,809.52 → 273,810)
    expect(vatShare(57_500_00n, 5)).toBe(2_738_10n)
  })

  it.each([
    // [market, inclusive total in minor units, rate %, expected VAT in minor units]
    ['UAE 5 %, AED 2 dp', 105_00n, 5, 5_00n],
    ['KSA 15 %, SAR 2 dp', 115_00n, 15, 15_00n],
    ['KSA 15 %, SAR 2 dp, rounds .52 up', 100_00n, 15, 13_04n], // 10000×15/115 = 1304.35
    ['Bahrain 10 %, BHD 3 dp', 110_000n, 10, 10_000n],
    ['Bahrain 10 %, BHD 3 dp, rounds', 1_000n, 10, 91n], // 1000×10/110 = 90.909
    ['Oman 5 %, OMR 3 dp', 2_944_750n, 5, 140_226n], // 2944750×5/105 = 140226.19
    ['Kuwait 0 %, KWD 3 dp', 2_944_750n, 0, 0n],
    ['Qatar 0 %, QAR 2 dp', 1_234_56n, 0, 0n],
  ])('%s', (_label, total, rate, expected) => {
    expect(vatShare(total, rate)).toBe(expected)
  })

  it('rounds an exact half up, never down', () => {
    // 21 × 5 / 105 = 1.0 exactly; 31.5 cases need a total where the share lands on .5:
    // total 1050 at 5 % → 1050×5/105 = 50 exactly; total 21 at 5 % → 1.0; total 63 at 5 % → 3.0
    // 2.5-share: total × 500 / 10500 = 2.5  →  total = 52.5 (not integer), so use 10 %:
    // total × 1000 / 11000 = 2.5 → total = 27.5; use 25 %: total × 2500 / 12500 = 2.5 → 12.5;
    // use 100 %: total × 10000 / 20000 = 2.5 → total = 5 → share 2.5 → 3
    expect(vatShare(5n, 100)).toBe(3n)
    expect(vatShare(-5n, 100)).toBe(-3n) // refunds mirror sales
  })

  it('is exact beyond Number.MAX_SAFE_INTEGER', () => {
    const big = 9_007_199_254_740_993_00n // > 2^53 in minor units
    // big × 5 / 105 computed with bigint; check against an independent exact computation
    const expected = (big * 500n * 2n + 10_500n) / (10_500n * 2n)
    expect(vatShare(big, 5)).toBe(expected)
  })

  it('supports a two-decimal rate and rejects finer ones', () => {
    expect(vatShare(10_000n, 2.5)).toBe(244n) // 10000×250/10250 = 243.90
    expect(() => vatShare(10_000n, 2.555)).toThrow(/two decimal places/)
  })

  it('rejects rates outside 0–100 %', () => {
    expect(() => vatShare(100n, -1)).toThrow(RangeError)
    expect(() => vatShare(100n, 101)).toThrow(RangeError)
    expect(() => vatShare(100n, Number.NaN)).toThrow(RangeError)
  })

  it('keeps the currency on a Money value', () => {
    expect(vatShareOf(money(57_500_00, 'AED', 2), 5)).toEqual({
      amount: 2_738_10n,
      currency: 'AED',
      decimals: 2,
    })
  })
})

describe('divideRoundHalfUp', () => {
  it.each([
    [5n, 2n, 3n],
    [-5n, 2n, -3n],
    [5n, -2n, -3n],
    [4n, 2n, 2n],
    [7n, 3n, 2n],
    [8n, 3n, 3n],
    [0n, 7n, 0n],
  ])('%s ÷ %s = %s', (n, d, expected) => {
    expect(divideRoundHalfUp(n, d)).toBe(expected)
  })

  it('refuses division by zero', () => {
    expect(() => divideRoundHalfUp(1n, 0n)).toThrow(RangeError)
  })
})

describe('roundToDecimals', () => {
  it.each([
    [1.005, 2, 1.01], // Math.round(1.005 * 100) / 100 would give 1
    [1.0049, 2, 1],
    [2.5, 0, 3],
    [-2.5, 0, -3],
    [0.0005, 3, 0.001],
    [2944.7495, 3, 2944.75],
    [123.456, 0, 123],
    [1e21, 2, 1e21],
    [5e-7, 6, 0.000001],
  ])('roundToDecimals(%s, %s) = %s', (value, decimals, expected) => {
    expect(roundToDecimals(value, decimals)).toBe(expected)
  })

  it('rejects bad input', () => {
    expect(() => roundToDecimals(Number.POSITIVE_INFINITY, 2)).toThrow(RangeError)
    expect(() => roundToDecimals(1, -1)).toThrow(RangeError)
    expect(() => roundToDecimals(1, 1.5)).toThrow(RangeError)
  })
})
