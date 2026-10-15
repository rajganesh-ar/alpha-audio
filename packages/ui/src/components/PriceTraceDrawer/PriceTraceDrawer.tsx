import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface TraceRow {
  /** The rule, translated ("Contract price"). */
  label: string
  /** What it gave, formatted ("AED 6,900.00", "−5%"); empty when it did not apply. */
  value?: string | undefined
  /** `applied`: it set or changed the price; `checked`: looked at, did not apply; `skipped`. */
  state: 'applied' | 'checked' | 'skipped'
}

export interface PriceTraceDrawerProps {
  /** The disclosure's label, e.g. "Why this price". */
  label: string
  rows: readonly TraceRow[]
  /** Words for the states, translated. */
  stateLabels: Record<TraceRow['state'], string>
  emptyLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
  /** Start open (stories, or a page that explains one price). */
  open?: boolean | undefined
}

/**
 * "Why this price" (spec: PriceTraceDrawer): the engine's trace as a disclosure, so it works
 * without JavaScript. Each rule says whether it applied, was checked, or was skipped, in words
 * and an icon (never colour alone). Shows only the company's own outcome, never rule data.
 */
export function PriceTraceDrawer({
  label,
  rows,
  stateLabels,
  emptyLabel,
  loading = false,
  loadingLabel,
  error,
  open,
}: PriceTraceDrawerProps) {
  return (
    <details className="group" open={open}>
      <summary
        className={cx(
          'inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-control text-sm text-ink underline underline-offset-4 [&::-webkit-details-marker]:hidden',
          FOCUS_RING,
        )}
      >
        <Icon
          name="chevron-down"
          size={16}
          className="transition-transform group-open:rotate-180"
        />
        {label}
      </summary>
      <div className="mt-2 rounded-card border border-line p-3">
        {loading ? (
          <>
            <Skeleton lines={3} />
            {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
          </>
        ) : error ? (
          <p className="flex items-center gap-2 text-sm text-critical">
            <Icon name="alert" size={16} />
            {error}
          </p>
        ) : rows.length === 0 ? (
          emptyLabel ? (
            <p className="text-sm text-ink-muted">{emptyLabel}</p>
          ) : null
        ) : (
          <ol className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {rows.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-4">
                <span
                  className={cx(
                    'flex items-center gap-2',
                    row.state === 'skipped' ? 'text-ink-muted' : 'text-ink',
                  )}
                >
                  <Icon
                    name={
                      row.state === 'applied' ? 'check' : row.state === 'checked' ? 'close' : 'info'
                    }
                    size={16}
                  />
                  <span>
                    {row.label}
                    {row.value ? <span className="sr-only">: {stateLabels[row.state]}</span> : null}
                  </span>
                </span>
                <bdi
                  className={cx(
                    'tabular-nums',
                    row.state === 'applied' ? 'font-semibold text-ink' : 'text-ink-muted',
                  )}
                >
                  {row.value ?? stateLabels[row.state]}
                </bdi>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  )
}
