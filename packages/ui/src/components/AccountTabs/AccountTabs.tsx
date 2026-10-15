import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING, MOTION } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface AccountTab {
  label: string
  href: string
  current?: boolean | undefined
  /** Small count after the label (orders in progress). */
  count?: number | undefined
}

export interface AccountTabsProps {
  /** Landmark name, e.g. "My Alpha". */
  label: string
  tabs: readonly AccountTab[]
  /** Who is signed in, e.g. their email. */
  identity?: string | undefined
  /** The sign-out control (a small form). */
  signOut?: ReactNode | undefined
  emptyLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/**
 * My Alpha's sections (spec: Account components): orders now; systems, rooms, quotes,
 * warranties and service as they arrive. Links, not script tabs, so each section has its own
 * URL and works without JavaScript; the current one carries `aria-current="page"`.
 */
export function AccountTabs({
  label,
  tabs,
  identity,
  signOut,
  emptyLabel,
  loading = false,
  loadingLabel,
  error,
}: AccountTabsProps) {
  if (loading) {
    return (
      <div aria-busy="true" className="flex gap-2 border-b border-line pb-2">
        <Skeleton shape="block" className="h-11 w-24 rounded-control" />
        <Skeleton shape="block" className="h-11 w-24 rounded-control" />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-end sm:justify-between">
      <nav aria-label={label}>
        {error ? (
          <p className="flex items-center gap-2 text-base text-critical">
            <Icon name="alert" />
            {error}
          </p>
        ) : tabs.length === 0 ? (
          emptyLabel ? (
            <p className="text-base text-ink-muted">{emptyLabel}</p>
          ) : null
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
            {tabs.map((tab) => (
              <li key={tab.href}>
                <a
                  href={tab.href}
                  aria-current={tab.current ? 'page' : undefined}
                  className={cx(
                    'inline-flex min-h-11 items-center gap-2 rounded-control px-4 text-base',
                    tab.current
                      ? 'bg-lacquer font-semibold text-aluminium'
                      : 'text-ink hover:bg-aluminium-deep',
                    FOCUS_RING,
                    MOTION,
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined ? (
                    <span className="font-mono text-sm tabular-nums">{tab.count}</span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>
      {identity || signOut ? (
        <div className="flex flex-wrap items-center gap-3">
          {identity ? (
            <span className="text-sm text-ink-muted">
              <bdi>{identity}</bdi>
            </span>
          ) : null}
          {signOut}
        </div>
      ) : null}
    </div>
  )
}
