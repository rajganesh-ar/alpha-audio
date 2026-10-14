import { cx } from '../../lib/cx'
import { FOCUS_RING, MOTION } from '../../lib/styles'
import { Icon, type IconName } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface QuietAction {
  label: string
  icon: IconName
  href: string
  /** Small count after the icon (bag lines, saved items). */
  count?: number | undefined
  /** Translated count text for screen readers, e.g. "2 items". */
  countLabel?: string | undefined
  /** The count could not be read; shows an alert mark and says so. */
  errorLabel?: string | undefined
}

export interface QuietActionsProps {
  /** Landmark-free group name, e.g. "Shortcuts". */
  label: string
  actions: QuietAction[]
  /** Hide text labels below 80rem (icons stay named for screen readers). */
  compact?: boolean | undefined
  loading?: boolean | undefined
}

/** The quiet utility cluster in the header: search, account, bag. Never amber. */
export function QuietActions({
  label,
  actions,
  compact = true,
  loading = false,
}: QuietActionsProps) {
  if (loading) {
    return (
      <div role="group" aria-label={label} aria-busy="true" className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} shape="circle" className="size-11" />
        ))}
      </div>
    )
  }
  if (actions.length === 0) return null
  return (
    <ul aria-label={label} className="m-0 flex list-none items-center gap-1 p-0">
      {actions.map((action) => (
        <li key={action.href}>
          <a
            href={action.href}
            className={cx(
              'relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-control px-2 text-sm text-ink hover:bg-aluminium-deep',
              FOCUS_RING,
              MOTION,
            )}
          >
            <Icon name={action.icon} />
            <span className={cx(compact && 'sr-only xl:not-sr-only')}>{action.label}</span>
            {action.count !== undefined && !action.errorLabel ? (
              <span className="rounded-full bg-lacquer px-2 font-mono text-xs text-aluminium tabular-nums">
                <span aria-hidden="true">{action.count}</span>
                {action.countLabel ? <span className="sr-only">{action.countLabel}</span> : null}
              </span>
            ) : null}
            {action.errorLabel ? (
              <span className="text-critical">
                <Icon name="alert" size={16} />
                <span className="sr-only">{action.errorLabel}</span>
              </span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  )
}
