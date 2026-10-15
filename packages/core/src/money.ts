/**
 * Money: integer minor units with the currency and its decimals beside them (CLAUDE.md).
 *
 * Amounts are `bigint` so no value ever passes through floating point, and totals cannot
 * silently lose precision past 2^53. Display goes through `formatMoney`, which hands Intl an
 * exact decimal string and always uses Western digits, including on Arabic pages.
 */

export type CurrencyCode = 'AED' | 'SAR' | 'QAR' | 'KWD' | 'BHD' | 'OMR'

/** Decimals allowed for any currency the platform can price in. */
export type CurrencyDecimals = 0 | 1 | 2 | 3

export interface Money {
  /** Amount in minor units: fils for AED (1/100), fils for KWD (1/1000), and so on. */
  readonly amount: bigint
  readonly currency: CurrencyCode
  readonly decimals: CurrencyDecimals
}

export function money(
  amount: bigint | number,
  currency: CurrencyCode,
  decimals: CurrencyDecimals,
): Money {
  if (typeof amount === 'number' && !Number.isSafeInteger(amount)) {
    throw new RangeError(`money(): amount must be a safe integer in minor units, got ${amount}`)
  }
  return { amount: BigInt(amount), currency, decimals }
}

/**
 * Divides and rounds half away from zero, exactly. This is the platform's one rounding rule
 * ("round half-up at the last step"): 2.5 → 3 and −2.5 → −3, so a refund mirrors its sale.
 */
export function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError('divideRoundHalfUp(): division by zero')
  const negative = numerator < 0n !== denominator < 0n
  const n = numerator < 0n ? -numerator : numerator
  const d = denominator < 0n ? -denominator : denominator
  const quotient = (n * 2n + d) / (d * 2n)
  return negative ? -quotient : quotient
}

/** Basis points per percent: a rate of 5 % is 500 bp, 15.5 % is 1550 bp. */
const BP_PER_PERCENT = 100

function rateToBasisPoints(ratePercent: number): bigint {
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
    throw new RangeError(`VAT rate must be between 0 and 100 percent, got ${ratePercent}`)
  }
  const bp = Math.round(ratePercent * BP_PER_PERCENT)
  if (Math.abs(bp - ratePercent * BP_PER_PERCENT) > 1e-6) {
    throw new RangeError(`VAT rate supports at most two decimal places, got ${ratePercent}`)
  }
  return BigInt(bp)
}

/**
 * The VAT contained in a VAT-inclusive amount: `total × rate ÷ (100 + rate)`, rounded half-up
 * to the currency's minor unit. Takes and returns minor units.
 *
 *   vatShare(5_750_000n, 5) === 273_810n   // AED 57,500.00 incl. 5 % VAT → AED 2,738.10
 */
export function vatShare(totalInclusiveMinor: bigint, ratePercent: number): bigint {
  const bp = rateToBasisPoints(ratePercent)
  if (bp === 0n) return 0n
  const hundredPercentBp = BigInt(100 * BP_PER_PERCENT)
  return divideRoundHalfUp(totalInclusiveMinor * bp, hundredPercentBp + bp)
}

/** `vatShare` for a `Money`, keeping its currency. */
export function vatShareOf(total: Money, ratePercent: number): Money {
  return { ...total, amount: vatShare(total.amount, ratePercent) }
}

/**
 * Rounds a decimal value to `decimals` places, half away from zero, without floating-point
 * drift: `roundToDecimals(1.005, 2)` is `1.01`, where `Math.round(1.005 * 100) / 100` gives 1.
 * For rates and display ratios; money itself stays in integer minor units.
 */
export function roundToDecimals(value: number, decimals: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`roundToDecimals(): not finite: ${value}`)
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 20) {
    throw new RangeError(`roundToDecimals(): decimals must be an integer 0–20, got ${decimals}`)
  }
  const { digits, exponent, negative } = decompose(value)
  // value = digits × 10^exponent; we want an integer count of 10^-decimals units.
  const shift = exponent + decimals
  let units: bigint
  if (shift >= 0) {
    units = digits * 10n ** BigInt(shift)
  } else {
    units = divideRoundHalfUp(digits, 10n ** BigInt(-shift))
  }
  const signed = negative ? -units : units
  return Number(`${signed}e-${decimals}`)
}

/** Splits a finite number into its shortest exact decimal digits and a power-of-ten exponent. */
function decompose(value: number): { digits: bigint; exponent: number; negative: boolean } {
  const negative = value < 0 || Object.is(value, -0)
  const [mantissa = '0', exp = '0'] = Math.abs(value).toExponential().split('e')
  const [whole = '0', fraction = ''] = mantissa.split('.')
  return {
    digits: BigInt(whole + fraction),
    exponent: Number(exp) - fraction.length,
    negative,
  }
}

/** An exact decimal string, as Intl.NumberFormat accepts it (ES2023 Intl). */
export type DecimalString = `${number}`

/** Minor units as an exact decimal string: (273810n, 2) → "2738.10", (-5n, 3) → "-0.005". */
export function toDecimalString(amountMinor: bigint, decimals: number): DecimalString {
  const negative = amountMinor < 0n
  const sign = negative ? '-' : ''
  const abs = (negative ? -amountMinor : amountMinor).toString()
  if (decimals === 0) return `${sign}${abs}` as DecimalString
  const padded = abs.padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals)
  const fraction = padded.slice(-decimals)
  return `${sign}${whole}.${fraction}` as DecimalString
}

/**
 * Formats money for display in a market locale such as `en-AE` or `ar-KW`. Always Western
 * digits and always exactly the currency's decimals (KWD 2,944.750, never 2,944.75).
 *
 * `wholeUnits` drops the fraction, for amounts that are whole by construction, such as
 * price-filter band edges ("Under AED 10,000"). It refuses an amount with a fraction, so a
 * price can never be shown rounded.
 */
export function formatMoney(
  value: Money,
  locale: string,
  options: { wholeUnits?: boolean } = {},
): string {
  const unit = 10n ** BigInt(value.decimals)
  if (options.wholeUnits && value.amount % unit !== 0n) {
    throw new RangeError(
      `formatMoney(): ${toDecimalString(value.amount, value.decimals)} is not a whole amount`,
    )
  }
  const digits = options.wholeUnits ? 0 : value.decimals
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
    numberingSystem: 'latn',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toDecimalString(value.amount, value.decimals))
}
