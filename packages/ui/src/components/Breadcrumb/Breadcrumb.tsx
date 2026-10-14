import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface BreadcrumbItem {
  label: string
  /** Omitted on the current page (the last item). */
  href?: string | undefined
}

export interface BreadcrumbProps {
  /** Landmark name, e.g. "Breadcrumb". */
  label: string
  items: BreadcrumbItem[]
  loading?: boolean | undefined
}

/** Trail to the current page. Separators are directional chevrons and mirror in RTL. */
export function Breadcrumb({ label, items, loading = false }: BreadcrumbProps) {
  if (loading) {
    return (
      <nav aria-label={label} aria-busy="true" className="flex items-center gap-2">
        <Skeleton lines={1} className="w-16" />
        <Skeleton lines={1} className="w-24" />
        <Skeleton lines={1} className="w-32" />
      </nav>
    )
  }
  if (items.length === 0) return null
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-x-1 text-sm text-ink-muted">
        {items.map((item, i) => {
          const current = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 ? <Icon name="chevron-forward" size={16} /> : null}
              {item.href && !current ? (
                <a
                  href={item.href}
                  className={cx(
                    'inline-flex min-h-11 items-center underline-offset-4 hover:text-ink hover:underline',
                    FOCUS_RING,
                  )}
                >
                  {item.label}
                </a>
              ) : (
                <span
                  aria-current={current ? 'page' : undefined}
                  className={cx(
                    'inline-flex min-h-11 items-center',
                    current && 'font-semibold text-ink',
                  )}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
