import { cx } from '../../lib/cx'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface CreditMeterProps {
  label: string
  /** Share of the limit in use, 0 to 1 (above 1 when over); null without a credit line. */
  ratio: number | null
  /** e.g. "AED 28,980.00 used of AED 50,000.00". */
  summary?: string | undefined
  /** e.g. "AED 21,020.00 available". */
  available?: string | undefined
  /** Shown instead of the bar when the company has no credit line. */
  emptyLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/**
 * The company's credit position (spec: CreditMeter): a bar for the share in use with the
 * amounts in words beside it, so colour is never the only signal. Over the limit (or at it) the
 * bar turns critical and the words say so.
 */
export function CreditMeter({
  label,
  ratio,
  summary,
  available,
  emptyLabel,
  loading = false,
  loadingLabel,
  error,
}: CreditMeterProps) {
  if (loading)
    return (
      <div aria-busy="true" className="flex flex-col gap-2">
        <Skeleton lines={2} />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </div>
    )
  if (error)
    return (
      <p className="flex items-center gap-2 text-sm text-critical">
        <Icon name="alert" size={16} />
        {error}
      </p>
    )
  const full = ratio !== null && ratio >= 1
  const percent = ratio === null ? 0 : Math.round(Math.min(Math.max(ratio, 0), 1) * 100)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {ratio === null ? null : available ? (
          <p className={cx('text-sm tabular-nums', full ? 'text-critical' : 'text-ink')}>
            <bdi>{available}</bdi>
          </p>
        ) : null}
      </div>
      {ratio === null ? (
        emptyLabel ? (
          <p className="text-sm text-ink-muted">{emptyLabel}</p>
        ) : null
      ) : (
        <>
          <div
            role="meter"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={summary}
            className="h-2 w-full overflow-hidden rounded-full bg-line"
          >
            <div
              className={cx('h-full rounded-full', full ? 'bg-critical' : 'bg-ink')}
              style={{ inlineSize: `${percent}%` }}
            />
          </div>
          {summary ? (
            <p className="text-sm text-ink-muted tabular-nums">
              <bdi>{summary}</bdi>
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
