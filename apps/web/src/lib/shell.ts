import { getDictionary, translator, type MarketOption } from '@alpha/ui'
import { languageTag, liveMarkets, type MarketRecord, type MarketRoute } from '@alpha/payload'
import { localizedPath } from './seo'

/**
 * Every live market × locale as a switcher option. Each label is written in the option's own
 * language ("الإمارات العربية المتحدة · العربية"), as people look for their own language.
 */
export function marketOptions(
  markets: readonly MarketRecord[],
  current?: MarketRoute,
): MarketOption[] {
  return liveMarkets(markets).flatMap((market) =>
    market.locales.map((locale) => {
      const t = translator(getDictionary(locale))
      return {
        label: `${market.name[locale]} · ${t(`languages.${locale}`)}`,
        href: localizedPath(market.code, locale),
        hrefLang: languageTag(locale, market),
        current: current?.market.code === market.code && current.locale === locale,
      }
    }),
  )
}
