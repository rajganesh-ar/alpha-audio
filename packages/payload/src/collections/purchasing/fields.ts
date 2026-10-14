import type { Field } from 'payload'
import { validateDecimals } from '../../markets/validate'

const KNOWN_CURRENCIES = new Set(Intl.supportedValuesOf('currency'))

/** True for a real ISO 4217 code (Intl.NumberFormat alone accepts any three letters). */
export const isCurrencyCode = (value: unknown): value is string =>
  typeof value === 'string' && KNOWN_CURRENCIES.has(value)

/** ISO 4217 currency code (suppliers bill in USD, EUR, GBP, JPY… as well as GCC currencies). */
export const currencyField = (name = 'currency'): Field => ({
  name,
  type: 'text',
  required: true,
  admin: { width: '20%', description: 'ISO 4217, e.g. USD.' },
  validate: (value: unknown) =>
    isCurrencyCode(value) ? true : 'Use a three-letter ISO 4217 currency code, e.g. USD.',
})

/** Decimals of the currency beside it (CLAUDE.md: money is minor units with currency and decimals). */
export const decimalsField: Field = {
  name: 'decimals',
  type: 'number',
  required: true,
  admin: { width: '15%', description: 'Minor units of the currency (2 for USD, 3 for KWD).' },
  validate: (value: unknown, { siblingData }: { siblingData: unknown }) =>
    validateDecimals(value, (siblingData as { currency?: unknown }).currency),
}

export const wholeNumber = (label: string, min: number) => (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'number' && Number.isSafeInteger(value) && value >= min)
    ? true
    : `${label} must be a whole number of at least ${min}.`
