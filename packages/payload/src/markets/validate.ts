/**
 * Validators for the Markets global, as pure functions so they are unit-tested without Payload.
 * Each returns `true` or a message, matching Payload's `validate` contract.
 */

/** ISO 4217 minor-unit digits for a currency, from the runtime's Intl data (AED 2, KWD 3). */
export function isoMinorUnits(currency: string): number | null {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits as number
  } catch {
    return null
  }
}

export function validateDecimals(decimals: unknown, currency: unknown): true | string {
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 3) {
    return 'Decimals must be a whole number from 0 to 3.'
  }
  if (typeof currency !== 'string' || !currency) return true // currency's own validator reports it
  const iso = isoMinorUnits(currency)
  if (iso !== null && iso !== decimals) {
    return `${currency} has ${iso} decimal places (ISO 4217); got ${decimals}.`
  }
  return true
}

export function validateVatRate(rate: unknown): true | string {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return 'VAT rate is required.'
  if (rate < 0 || rate > 100) return 'VAT rate must be between 0 and 100 percent.'
  if (Math.abs(Math.round(rate * 100) - rate * 100) > 1e-6) {
    return 'VAT rate supports at most two decimal places.'
  }
  return true
}

export function validateTimezone(timezone: unknown): true | string {
  if (typeof timezone !== 'string' || !timezone) return 'Time zone is required.'
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone })
    return true
  } catch {
    return `"${timezone}" is not an IANA time zone (for example Asia/Dubai).`
  }
}

export function validateUniqueCodes(rows: unknown): true | string {
  if (!Array.isArray(rows)) return true
  const seen = new Set<string>()
  for (const row of rows) {
    const code = (row as { code?: unknown } | null)?.code
    if (typeof code !== 'string') continue
    if (seen.has(code)) return `Market "${code}" appears more than once.`
    seen.add(code)
  }
  return true
}

export function validateLocales(locales: unknown): true | string {
  return Array.isArray(locales) && locales.length > 0 ? true : 'Choose at least one locale.'
}
