import { describe, expect, it } from 'vitest'
import { pickSuggestion, readCookie, type SuggestedMarketTarget } from './SuggestedMarketBanner'

const sa: SuggestedMarketTarget = {
  code: 'sa',
  href: '/sa/en/',
  hrefLang: 'en-SA',
  message: 'm',
  switchLabel: 's',
}

describe('suggested market banner', () => {
  it('reads cookies', () => {
    expect(readCookie('a=1; suggestedMarket=sa; b=2', 'suggestedMarket')).toBe('sa')
    expect(readCookie('a=1', 'suggestedMarket')).toBeNull()
    expect(readCookie('x=a%20b', 'x')).toBe('a b')
  })

  it.each([
    ['suggestedMarket=sa', 'ae', 'sa'],
    ['suggestedMarket=ae', 'ae', null], // already there
    ['suggestedMarket=qa', 'ae', null], // not live: no target
    ['suggestedMarket=sa; suggestedMarketDismissed=sa', 'ae', null],
    ['suggestedMarket=sa; suggestedMarketDismissed=kw', 'ae', 'sa'],
    ['', 'ae', null],
  ])('%s on %s → %s', (cookies, current, expected) => {
    expect(pickSuggestion(cookies, current, [sa])?.code ?? null).toBe(expected)
  })
})
