/**
 * The closed sets the Markets global is built from. Pure constants with no Payload or I/O
 * imports, so `proxy.ts` can use them without pulling Payload into the request path.
 *
 * These are the schema's enums (select options), not business rules: which markets are live,
 * their VAT, rails and locales are data in the Markets global. Adding a code here is a schema
 * change and ships with a migration.
 */

export const MARKET_CODES = ['ae', 'sa', 'qa', 'kw', 'bh', 'om'] as const
export type MarketCode = (typeof MARKET_CODES)[number]

export const LOCALE_CODES = ['en', 'ar'] as const
export type LocaleCode = (typeof LOCALE_CODES)[number]

export const MARKET_STATUSES = ['live', 'soon', 'off'] as const
export type MarketStatus = (typeof MARKET_STATUSES)[number]

export const FULFILMENT_MODES = ['alpha', 'dealer'] as const
export type FulfilmentMode = (typeof FULFILMENT_MODES)[number]

export const PAYMENT_RAILS = [
  'card',
  'applepay',
  'googlepay',
  'tabby',
  'tamara',
  'cod',
  'mada',
  'naps',
  'knet',
  'benefitpay',
  'omannet',
] as const
export type PaymentRail = (typeof PAYMENT_RAILS)[number]

/** How the checkout captures an address in each market (spec: GCC market layer). */
export const ADDRESS_SCHEMES = [
  'ae-makani',
  'sa-national-address',
  'qa-zone',
  'kw-paci',
  'bh-block',
  'om-way',
] as const
export type AddressScheme = (typeof ADDRESS_SCHEMES)[number]

/** The default route: `/` redirects here and it is the hreflang `x-default` (spec). */
export const DEFAULT_MARKET: MarketCode = 'ae'
export const DEFAULT_LOCALE: LocaleCode = 'en'

export function isMarketCode(value: string): value is MarketCode {
  return (MARKET_CODES as readonly string[]).includes(value)
}

export function isLocaleCode(value: string): value is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(value)
}

/**
 * ISO 3166-1 alpha-2 country (as sent in Cloudflare's `cf-ipcountry`) to market code. This is
 * the identity mapping of country to the market that serves it, used only to *suggest* a
 * market; it never redirects. Countries outside the GCC get no suggestion.
 */
export function marketForCountry(country: string | null | undefined): MarketCode | null {
  if (!country) return null
  const code = country.trim().toLowerCase()
  return isMarketCode(code) ? code : null
}
