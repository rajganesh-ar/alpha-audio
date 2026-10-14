import type { CurrencyCode, CurrencyDecimals } from '@alpha/core'
import type {
  AddressScheme,
  FulfilmentMode,
  LocaleCode,
  MarketCode,
  MarketStatus,
  PaymentRail,
} from './codes'

/** One market as the storefront reads it from the Markets global. */
export interface MarketRecord {
  code: MarketCode
  /** Display name in each locale, e.g. { en: 'United Arab Emirates', ar: 'الإمارات' }. */
  name: Record<LocaleCode, string>
  currency: CurrencyCode
  decimals: CurrencyDecimals
  /** VAT in percent, e.g. 5 for UAE, 15 for Saudi Arabia, 0 for Qatar. */
  vatRate: number
  locales: LocaleCode[]
  payments: PaymentRail[]
  addressScheme: AddressScheme
  fulfilment: FulfilmentMode
  status: MarketStatus
  /** IANA time zone, e.g. Asia/Dubai. */
  timezone: string
}

/** A validated storefront route: a live market and one of its enabled locales. */
export interface MarketRoute {
  market: MarketRecord
  locale: LocaleCode
  /** BCP 47 tag for html[lang], hreflang and Intl, e.g. 'ar-AE'. */
  languageTag: string
  dir: 'ltr' | 'rtl'
}
