import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Skeleton } from '../Skeleton/Skeleton'

export interface NavItem {
  label: string
  href: string
  current?: boolean | undefined
}

export interface HeaderProps {
  homeHref: string
  /** Wordmark text; the logo asset replaces it later and never mirrors. */
  brand: string
  homeLabel: string
  navLabel: string
  nav: NavItem[]
  /** QuietActions, MarketSwitch: at the inline end, so on the left in Arabic. */
  actions?: ReactNode | undefined
  /** Navigation still loading (from Payload). */
  loading?: boolean | undefined
}

/**
 * Wordmark, navigation, actions. A flex row in document direction, so it mirrors in RTL with
 * no per-locale code. On narrow screens the navigation moves to its own row.
 */
export function Header({
  homeHref,
  brand,
  homeLabel,
  navLabel,
  nav,
  actions,
  loading = false,
}: HeaderProps) {
  return (
    <header className="border-b border-line" data-testid="site-header">
      <div className="mx-auto flex max-w-measure flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <a
          href={homeHref}
          aria-label={homeLabel}
          className={cx(
            'inline-flex min-h-11 items-center font-display text-xl font-bold whitespace-nowrap text-lacquer font-stretch-expanded',
            FOCUS_RING,
          )}
          data-testid="header-brand"
        >
          {brand}
        </a>
        <nav
          aria-label={navLabel}
          aria-busy={loading || undefined}
          className="order-3 basis-full lg:order-none lg:basis-auto lg:flex-1"
        >
          {loading ? (
            <div className="flex gap-4 py-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} lines={1} className="w-20" />
              ))}
            </div>
          ) : nav.length ? (
            <ul className="m-0 flex list-none flex-wrap gap-x-2 p-0">
              {nav.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    aria-current={item.current ? 'page' : undefined}
                    className={cx(
                      'inline-flex min-h-11 items-center rounded-control px-2 text-base text-ink underline-offset-4 hover:underline aria-[current=page]:font-semibold',
                      FOCUS_RING,
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </nav>
        {actions ? (
          <div className="ms-auto flex items-center gap-2" data-testid="header-actions">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}
