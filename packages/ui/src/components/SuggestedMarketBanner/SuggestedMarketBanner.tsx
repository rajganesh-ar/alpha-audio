'use client'

import { useEffect, useState } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import {
  SUGGESTED_MARKET_COOKIE,
  SUGGESTED_MARKET_DISMISSED_COOKIE,
  SUGGESTED_MARKET_MAX_AGE,
} from '../../lib/cookies'

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
  /** Where cookies are read from; `document.cookie` in the browser. Stories pass a fixed string. */
  readCookies?: (() => string) | undefined
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

const browserCookies = () => document.cookie

/**
 * The geo hint. The proxy sets `suggestedMarket` from the visitor's country; this offers the
 * switch and never redirects. It reads the cookie in the browser so the page stays cacheable,
 * and renders nothing until then.
 */
export function SuggestedMarketBanner({
  currentMarket,
  targets,
  dismissLabel,
  readCookies = browserCookies,
}: SuggestedMarketBannerProps) {
  const [target, setTarget] = useState<SuggestedMarketTarget | null>(null)

  useEffect(() => {
    setTarget(pickSuggestion(readCookies(), currentMarket, targets))
  }, [currentMarket, targets, readCookies])

  if (!target) return null

  const dismiss = () => {
    document.cookie = `${SUGGESTED_MARKET_DISMISSED_COOKIE}=${encodeURIComponent(target.code)}; path=/; max-age=${SUGGESTED_MARKET_MAX_AGE}; samesite=lax`
    setTarget(null)
  }

  return (
    <div
      role="region"
      aria-label={target.message}
      className="bg-aluminium-deep"
      data-testid="suggested-market"
    >
      <div className="mx-auto flex max-w-measure flex-wrap items-center gap-3 px-4 py-2">
        <p className="me-auto text-base text-ink">{target.message}</p>
        <a
          href={target.href}
          hrefLang={target.hrefLang}
          className={cx(
            'inline-flex min-h-11 items-center rounded-control bg-vu-amber px-4 font-semibold text-lacquer',
            FOCUS_RING,
          )}
        >
          {target.switchLabel}
        </a>
        <button
          type="button"
          onClick={dismiss}
          className={cx(
            'inline-flex min-h-11 items-center rounded-control border border-ink px-4 text-ink',
            FOCUS_RING,
          )}
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  )
}
