import { cx } from '../../lib/cx'
import { FOCUS_RING, MOTION, TARGET } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface PaginationProps {
  /** Landmark name, e.g. "Pagination". */
  label: string
  current: number
  pages: number
  /** URL of a page, keeping the active filters. */
  hrefFor: (page: number) => string
  previousLabel: string
  nextLabel: string
  /** Accessible name of a page link with `{page}`, e.g. "Page {page}". */
  pageLabel: string
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/** Page numbers to show: first, last, and the current page with its neighbours; gaps as null. */
export function pageWindow(current: number, pages: number): Array<number | null> {
  const wanted = [...new Set([1, current - 1, current, current + 1, pages])]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b)
  return wanted.flatMap((p, i) => (i > 0 && p - (wanted[i - 1] ?? p) > 1 ? [null, p] : [p]))
}

/** Page links for a listing. Nothing renders for a single page. */
export function Pagination({
  label,
  current,
  pages,
  hrefFor,
  previousLabel,
  nextLabel,
  pageLabel,
  loading = false,
  loadingLabel,
  error,
}: PaginationProps) {
  if (loading) {
    return (
      <div aria-busy="true" className="flex justify-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} shape="block" className="size-11 rounded-control" />
        ))}
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </div>
    )
  }
  if (error) {
    return (
      <p className="flex items-center justify-center gap-2 text-base text-critical">
        <Icon name="alert" />
        {error}
      </p>
    )
  }
  if (pages <= 1) return null
  const link = cx(
    'inline-flex items-center justify-center gap-2 rounded-control border px-3 text-base tabular-nums',
    TARGET,
    FOCUS_RING,
    MOTION,
  )
  return (
    <nav aria-label={label} className="flex justify-center">
      <ul className="flex flex-wrap items-center gap-2">
        {current > 1 ? (
          <li>
            <a
              href={hrefFor(current - 1)}
              rel="prev"
              className={cx(link, 'border-line-strong text-ink hover:border-ink')}
            >
              <Icon name="chevron-forward" className="rotate-180" />
              {previousLabel}
            </a>
          </li>
        ) : null}
        {pageWindow(current, pages).map((page, i) =>
          page === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-muted">
              …
            </li>
          ) : (
            <li key={page}>
              <a
                href={hrefFor(page)}
                aria-label={pageLabel.replace('{page}', String(page))}
                aria-current={page === current ? 'page' : undefined}
                className={cx(
                  link,
                  page === current
                    ? 'border-lacquer bg-lacquer font-semibold text-aluminium'
                    : 'border-line-strong text-ink hover:border-ink',
                )}
              >
                {page}
              </a>
            </li>
          ),
        )}
        {current < pages ? (
          <li>
            <a
              href={hrefFor(current + 1)}
              rel="next"
              className={cx(link, 'border-line-strong text-ink hover:border-ink')}
            >
              {nextLabel}
              <Icon name="chevron-forward" />
            </a>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
