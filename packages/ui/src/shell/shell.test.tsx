import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AnnouncementBar, AppShell, Footer, Header, MarketSwitch } from './index'
import { pickSuggestion, readCookie, type SuggestedMarketTarget } from './SuggestedMarketBanner'

const options = [
  { label: 'United Arab Emirates · English', href: '/ae/en/', hrefLang: 'en-AE', current: true },
  {
    label: 'الإمارات العربية المتحدة · العربية',
    href: '/ae/ar/',
    hrefLang: 'ar-AE',
    current: false,
  },
]

function shell(rtl: boolean) {
  return renderToStaticMarkup(
    <div dir={rtl ? 'rtl' : 'ltr'}>
      <AppShell
        skipToContentLabel="SKIP"
        announcement={<AnnouncementBar>NOTICE</AnnouncementBar>}
        header={
          <Header
            homeHref="/ae/en/"
            brand="BRAND"
            homeLabel="HOME"
            navLabel="NAV"
            nav={[{ label: 'ONE', href: '/ae/en/one/' }]}
            actions={<MarketSwitch label="SWITCH" currentLabel="CURRENT" options={options} />}
          />
        }
        footer={<Footer copyright="COPY" pricing="PRICING" />}
      >
        BODY
      </AppShell>
    </div>,
  )
}

describe('shell', () => {
  it('renders the landmarks in reading order with a skip link to main', () => {
    const html = shell(false)
    const order = [
      'href="#main"',
      'NOTICE',
      '<header',
      'BRAND',
      'aria-label="NAV"',
      'CURRENT',
      '<main id="main"',
      'BODY',
      '<footer',
    ]
    const positions = order.map((s) => html.indexOf(s))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('takes every visible string from props (no hard-coded copy)', () => {
    const text = shell(false)
      .replace(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
    const allowed = new Set([
      'SKIP',
      'NOTICE',
      'BRAND',
      'ONE',
      'CURRENT',
      'BODY',
      'COPY',
      'PRICING',
      '·',
    ])
    const fromOptions = options.flatMap((o) => o.label.split(/\s+/))
    expect(text.filter((w) => !allowed.has(w) && !fromOptions.includes(w))).toEqual([])
  })

  it('renders the same structure in RTL; direction is inherited, not branched on', () => {
    expect(shell(true).replace('dir="rtl"', '')).toBe(shell(false).replace('dir="ltr"', ''))
  })

  it('marks the current option and tags each option with its language', () => {
    const html = renderToStaticMarkup(
      <MarketSwitch label="SWITCH" options={options} variant="list" />,
    )
    expect(html).toContain(
      'href="/ae/en/" hrefLang="en-AE" lang="en-AE" dir="auto" aria-current="page"',
    )
    expect(html).toContain('href="/ae/ar/" hrefLang="ar-AE" lang="ar-AE" dir="auto">')
    expect(html).not.toContain('<details')
  })

  it('omits optional parts cleanly', () => {
    const html = renderToStaticMarkup(
      <Header homeHref="/" brand="B" homeLabel="H" navLabel="N" nav={[]} />,
    )
    expect(html).not.toContain('header-actions')
    expect(renderToStaticMarkup(<Footer copyright="C" />)).not.toContain('PRICING')
  })
})

describe('suggested market banner', () => {
  const sa: SuggestedMarketTarget = {
    code: 'sa',
    href: '/sa/en/',
    hrefLang: 'en-SA',
    message: 'm',
    switchLabel: 's',
  }

  it('reads cookies', () => {
    expect(readCookie('a=1; suggestedMarket=sa; b=2', 'suggestedMarket')).toBe('sa')
    expect(readCookie('a=1', 'suggestedMarket')).toBeNull()
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
