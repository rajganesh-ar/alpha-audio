import { isLocaleCode, isMarketCode, type LocaleCode } from './codes'
import type { MarketRecord, MarketRoute } from './types'

/** Locales written right to left. A property of the language, not of the market. */
const RTL_LOCALES: ReadonlySet<LocaleCode> = new Set<LocaleCode>(['ar'])

export function directionFor(locale: LocaleCode): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'
}

/** BCP 47 tag for a locale in a market: ('ar', 'ae') → 'ar-AE'. */
export function languageTag(locale: LocaleCode, market: MarketRecord): string {
  return `${locale}-${market.code.toUpperCase()}`
}

export function liveMarkets(markets: readonly MarketRecord[]): MarketRecord[] {
  return markets.filter((m) => m.status === 'live')
}

/**
 * Validates the `[market]/[locale]` segments against the Markets record: the market must exist
 * and be live, and the locale must be one it offers. Returns null for anything else, which the
 * layout turns into a 404. Market and locale come from the path only (spec: routing rules).
 */
export function resolveMarketRoute(
  markets: readonly MarketRecord[],
  marketParam: string,
  localeParam: string,
): MarketRoute | null {
  if (!isMarketCode(marketParam) || !isLocaleCode(localeParam)) return null
  const market = markets.find((m) => m.code === marketParam)
  if (!market || market.status !== 'live' || !market.locales.includes(localeParam)) return null
  return {
    market,
    locale: localeParam,
    languageTag: languageTag(localeParam, market),
    dir: directionFor(localeParam),
  }
}
