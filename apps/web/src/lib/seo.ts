import type { Metadata } from 'next'
import {
  DEFAULT_LOCALE,
  DEFAULT_MARKET,
  languageTag,
  liveMarkets,
  type LocaleCode,
  type MarketRecord,
} from '@alpha/payload'

/** Public origin, for absolute canonical and hreflang URLs. */
export function siteUrl(source: Record<string, string | undefined> = process.env): URL {
  const raw = source['NEXT_PUBLIC_SERVER_URL']
  if (!raw) throw new Error('NEXT_PUBLIC_SERVER_URL is not set')
  return new URL(raw)
}

/** `/{market}/{locale}{path}` with exactly one leading and one trailing slash. */
export function localizedPath(market: string, locale: string, path = '/'): string {
  const inner = path.split('/').filter(Boolean).join('/')
  return `/${market}/${locale}/${inner ? `${inner}/` : ''}`
}

export interface HreflangLink {
  hrefLang: string
  href: string
}

/**
 * One alternate per live market × enabled locale (`en-AE`, `ar-AE`, …) plus `x-default`,
 * which points at the default market and locale (`/ae/en/…`). `path` is the part of the URL
 * after the locale, identical across alternates.
 */
export function hreflangLinks(markets: readonly MarketRecord[], path = '/'): HreflangLink[] {
  const links = liveMarkets(markets).flatMap((market) =>
    market.locales.map((locale) => ({
      hrefLang: languageTag(locale, market),
      href: localizedPath(market.code, locale, path),
    })),
  )
  return [
    ...links,
    { hrefLang: 'x-default', href: localizedPath(DEFAULT_MARKET, DEFAULT_LOCALE, path) },
  ]
}

/** Next.js `alternates` for a page: self-canonical plus the hreflang set. */
export function alternatesFor(
  markets: readonly MarketRecord[],
  current: { market: { code: string }; locale: LocaleCode },
  path = '/',
): NonNullable<Metadata['alternates']> {
  return {
    canonical: localizedPath(current.market.code, current.locale, path),
    languages: Object.fromEntries(hreflangLinks(markets, path).map((l) => [l.hrefLang, l.href])),
  }
}
