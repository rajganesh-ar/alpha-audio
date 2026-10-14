export interface MarketOption {
  /** Market and language as the visitor reads it, e.g. "United Arab Emirates · العربية". */
  label: string
  href: string
  /** BCP 47 tag of the target page, e.g. `ar-AE`. */
  hrefLang: string
  current: boolean
}

export interface MarketSwitchProps {
  label: string
  currentLabel?: string
  options: MarketOption[]
  /** `list` shows every option inline (404 page); `menu` folds them behind a disclosure (header). */
  variant?: 'menu' | 'list'
}

/**
 * Market and language picker. Plain links, so it works without JavaScript and every option
 * is a crawlable URL. The disclosure is a native `<details>`, keyboard operable by default.
 */
export function MarketSwitch({
  label,
  currentLabel,
  options,
  variant = 'menu',
}: MarketSwitchProps) {
  const list = (
    <ul className="alpha-market-switch__list">
      {options.map((option) => (
        <li key={option.href}>
          <a
            className="alpha-market-switch__option"
            href={option.href}
            hrefLang={option.hrefLang}
            lang={option.hrefLang}
            dir="auto"
            aria-current={option.current ? 'page' : undefined}
          >
            {option.label}
          </a>
        </li>
      ))}
    </ul>
  )

  if (variant === 'list') {
    return (
      <nav
        className="alpha-market-switch alpha-market-switch--list"
        aria-label={label}
        data-testid="market-switch"
      >
        {list}
      </nav>
    )
  }

  return (
    <nav className="alpha-market-switch" aria-label={label} data-testid="market-switch">
      <details className="alpha-market-switch__details">
        <summary className="alpha-market-switch__summary">{currentLabel ?? label}</summary>
        {list}
      </details>
    </nav>
  )
}
