'use client'

import { useEffect, useState } from 'react'
import {
  SUGGESTED_MARKET_COOKIE,
  SUGGESTED_MARKET_DISMISSED_COOKIE,
  SUGGESTED_MARKET_MAX_AGE,
} from './cookies'

export interface SuggestedMarketTarget {
  code: string
  href: string
  hrefLang: string
  message: string
  switchLabel: string
}

export interface SuggestedMarketBannerProps {
  currentMarket: string
  /** Live markets other than the current one, with their copy already translated. */
  targets: SuggestedMarketTarget[]
  dismissLabel: string
}

export function readCookie(cookies: string, name: string): string | null {
  for (const part of cookies.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

/** Which target, if any, to offer. Never the current market, never one the visitor dismissed. */
export function pickSuggestion(
  cookies: string,
  currentMarket: string,
  targets: SuggestedMarketTarget[],
): SuggestedMarketTarget | null {
  const suggested = readCookie(cookies, SUGGESTED_MARKET_COOKIE)
  if (!suggested || suggested === currentMarket) return null
  if (readCookie(cookies, SUGGESTED_MARKET_DISMISSED_COOKIE) === suggested) return null
  return targets.find((t) => t.code === suggested) ?? null
}

/**
 * The geo hint. The proxy sets `suggestedMarket` from the visitor's country; this banner
 * offers the switch and never redirects. It reads the cookie in the browser so the page around
 * it stays cacheable.
 */
export function SuggestedMarketBanner({
  currentMarket,
  targets,
  dismissLabel,
}: SuggestedMarketBannerProps) {
  const [target, setTarget] = useState<SuggestedMarketTarget | null>(null)

  useEffect(() => {
    setTarget(pickSuggestion(document.cookie, currentMarket, targets))
  }, [currentMarket, targets])

  if (!target) return null

  const dismiss = () => {
    document.cookie = `${SUGGESTED_MARKET_DISMISSED_COOKIE}=${encodeURIComponent(target.code)}; path=/; max-age=${SUGGESTED_MARKET_MAX_AGE}; samesite=lax`
    setTarget(null)
  }

  return (
    <div
      className="alpha-suggested-market"
      role="region"
      aria-label={target.message}
      data-testid="suggested-market"
    >
      <p className="alpha-suggested-market__text">{target.message}</p>
      <a className="alpha-suggested-market__switch" href={target.href} hrefLang={target.hrefLang}>
        {target.switchLabel}
      </a>
      <button type="button" className="alpha-suggested-market__dismiss" onClick={dismiss}>
        {dismissLabel}
      </button>
    </div>
  )
}
