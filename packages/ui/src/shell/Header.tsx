import type { ReactNode } from 'react'

export interface NavItem {
  label: string
  href: string
}

export interface HeaderProps {
  homeHref: string
  brand: string
  homeLabel: string
  navLabel: string
  nav: NavItem[]
  /** Usually a `MarketSwitch`. Sits at the inline end, so it moves to the left in Arabic. */
  actions?: ReactNode
}

/**
 * Wordmark at the inline start, navigation, then actions at the inline end. The row is a
 * flex container in document direction, so it mirrors in RTL without any per-locale code.
 */
export function Header({ homeHref, brand, homeLabel, navLabel, nav, actions }: HeaderProps) {
  return (
    <header className="alpha-header" data-testid="site-header">
      <a
        className="alpha-header__brand"
        href={homeHref}
        aria-label={homeLabel}
        data-testid="header-brand"
      >
        {brand}
      </a>
      <nav className="alpha-header__nav" aria-label={navLabel}>
        <ul className="alpha-header__nav-list">
          {nav.map((item) => (
            <li key={item.href}>
              <a className="alpha-header__nav-link" href={item.href}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {actions ? (
        <div className="alpha-header__actions" data-testid="header-actions">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
