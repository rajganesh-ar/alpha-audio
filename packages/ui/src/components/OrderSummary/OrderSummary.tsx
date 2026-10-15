import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface SummaryRow {
  label: string
  /** Already formatted with `formatMoney`. */
  value: string
  /** The grand total. */
  emphasis?: boolean | undefined
  /** Secondary rows such as "VAT included". */
  muted?: boolean | undefined
}

export interface OrderSummaryProps {
  title: string
  rows: readonly SummaryRow[]
  /** Small print under the totals, e.g. the delivery promise. */
  note?: string | undefined
  /** The next action (checkout button). */
  action?: ReactNode | undefined
  emptyLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/**
 * Bag or order totals. It formats nothing and computes nothing: amounts arrive formatted from
 * `packages/core` (VAT is the per-line share, summed). Amounts sit in `<bdi>` for Arabic.
 */
export function OrderSummary({
  title,
  rows,
  note,
  action,
  emptyLabel,
  loading = false,
  loadingLabel,
  error,
}: OrderSummaryProps) {
  const heading = <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
  const shell = 'flex flex-col gap-4 rounded-card border border-line bg-aluminium p-6'
  if (loading) {
    return (
      <section aria-busy="true" className={shell}>
        {heading}
        <Skeleton lines={4} />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </section>
    )
  }
  return (
    <section className={shell}>
      {heading}
      {error ? (
        <p className="flex items-center gap-2 text-base text-critical">
          <Icon name="alert" />
          {error}
        </p>
      ) : rows.length === 0 ? (
        emptyLabel ? (
          <p className="text-base text-ink-muted">{emptyLabel}</p>
        ) : null
      ) : (
        <dl className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className={cx(
                'flex items-baseline justify-between gap-4',
                row.emphasis && 'mt-2 border-t border-line-strong pt-3',
              )}
            >
              <dt
                className={cx(
                  row.emphasis
                    ? 'text-lg font-bold text-ink'
                    : row.muted
                      ? 'text-sm text-ink-muted'
                      : 'text-base text-ink',
                )}
              >
                {row.label}
              </dt>
              <dd
                className={cx(
                  'tabular-nums',
                  row.emphasis
                    ? 'font-display text-xl font-bold text-ink'
                    : row.muted
                      ? 'text-sm text-ink-muted'
                      : 'text-base text-ink',
                )}
              >
                <bdi>{row.value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {note ? <p className="text-sm text-ink-muted">{note}</p> : null}
      {action && !error && rows.length ? <div>{action}</div> : null}
    </section>
  )
}
