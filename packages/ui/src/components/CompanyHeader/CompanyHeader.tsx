import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface CompanyNavItem {
  label: string
  href: string
  current?: boolean | undefined
}

export interface CompanyHeaderProps {
  /** Wordmark, e.g. "Alpha Audio Partners". */
  brand: string
  homeHref: string
  navLabel: string
  nav: readonly CompanyNavItem[]
  /** The signed-in company. */
  company?: string | undefined
  /** Tier, already translated ("Gold"). */
  tier?: string | undefined
  /** Credit line, already formatted ("Credit AED 50,000.00"); only for owners and purchasers. */
  credit?: string | undefined
  /** A hold or other account notice, shown in the critical role. */
  notice?: string | undefined
  /** Sign-out control (a small form). */
  signOut?: ReactNode | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
}

/**
 * The dealer board's header band (spec: dealer header on lacquer): company, tier and credit at
 * the inline end, sections below. Dark band tokens (`data-tone="dark"`) recolour every role.
 */
export function CompanyHeader({
  brand,
  homeHref,
  navLabel,
  nav,
  company,
  tier,
  credit,
  notice,
  signOut,
  loading = false,
  loadingLabel,
}: CompanyHeaderProps) {
  return (
    <header data-tone="dark" className="border-b border-line">
      <div className="mx-auto flex max-w-measure flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <a
          href={homeHref}
          className={cx(
            'inline-flex min-h-11 items-center font-display text-xl font-bold whitespace-nowrap text-ink font-stretch-expanded',
            FOCUS_RING,
          )}
        >
          {brand}
        </a>
        <nav
          aria-label={navLabel}
          className="order-3 basis-full lg:order-none lg:basis-auto lg:flex-1"
        >
          <ul className="m-0 flex list-none flex-wrap gap-x-2 p-0">
            {nav.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  aria-current={item.current ? 'page' : undefined}
                  className={cx(
                    'inline-flex min-h-11 items-center rounded-control px-2 text-base text-ink underline-offset-4 hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline',
                    FOCUS_RING,
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div
          className="ms-auto flex flex-wrap items-center gap-x-4 gap-y-1"
          aria-busy={loading || undefined}
        >
          {loading ? (
            <>
              <Skeleton lines={1} className="w-40" />
              {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
            </>
          ) : (
            <>
              {company ? (
                <p className="flex flex-col text-end">
                  <span className="text-base font-semibold text-ink">{company}</span>
                  {tier || credit ? (
                    <span className="text-sm text-ink-muted">
                      {[tier, credit].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {signOut}
            </>
          )}
        </div>
      </div>
      {notice ? (
        <p
          role="status"
          className="mx-auto flex max-w-measure items-center gap-2 px-4 pb-3 text-sm text-critical"
        >
          <Icon name="alert" size={16} />
          {notice}
        </p>
      ) : null}
    </header>
  )
}
