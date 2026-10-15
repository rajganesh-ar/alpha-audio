import { cx } from '../../lib/cx'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface TimelineStep {
  key: string
  label: string
  /** When it happened or what to expect, already formatted (date in the market's timezone). */
  detail?: string | undefined
  /** `stopped` marks where an order ended early (cancelled, failed). */
  state: 'done' | 'current' | 'upcoming' | 'stopped'
}

export interface OrderTimelineProps {
  /** Accessible name of the list, e.g. "Order progress". */
  label: string
  steps: readonly TimelineStep[]
  emptyLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

const MARKER: Record<TimelineStep['state'], string> = {
  done: 'border-lacquer bg-lacquer text-aluminium',
  current: 'border-lacquer bg-aluminium text-ink',
  upcoming: 'border-line-strong bg-aluminium text-ink-muted',
  stopped: 'border-critical bg-aluminium text-critical',
}

/**
 * Where an order is: confirmed, picked, shipped, delivered (or where it stopped). A vertical
 * ordered list, so it reads the same in both directions; the state is told by icon and text,
 * never by colour alone, and the current step carries `aria-current="step"`.
 */
export function OrderTimeline({
  label,
  steps,
  emptyLabel,
  loading = false,
  loadingLabel,
  error,
}: OrderTimelineProps) {
  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton shape="circle" className="size-8" />
            <Skeleton lines={1} className="w-40" />
          </div>
        ))}
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </div>
    )
  }
  if (error) {
    return (
      <p className="flex items-center gap-2 text-base text-critical">
        <Icon name="alert" />
        {error}
      </p>
    )
  }
  if (steps.length === 0)
    return emptyLabel ? <p className="text-base text-ink-muted">{emptyLabel}</p> : null
  return (
    <ol aria-label={label} className="m-0 flex list-none flex-col p-0">
      {steps.map((step, index) => (
        <li
          key={step.key}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="relative flex gap-3 pb-6 last:pb-0"
        >
          {index < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className={cx(
                'absolute start-4 top-8 bottom-0 w-px -translate-x-1/2 rtl:translate-x-1/2',
                step.state === 'done' ? 'bg-lacquer' : 'bg-line-strong',
              )}
            />
          ) : null}
          <span
            aria-hidden="true"
            className={cx(
              'relative flex size-8 shrink-0 items-center justify-center rounded-full border-2',
              MARKER[step.state],
            )}
          >
            {step.state === 'done' ? (
              <Icon name="check" size={16} />
            ) : step.state === 'stopped' ? (
              <Icon name="close" size={16} />
            ) : step.state === 'current' ? (
              <span className="size-2.5 rounded-full bg-lacquer" />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-col pt-1">
            <span
              className={cx(
                'text-base',
                step.state === 'upcoming' ? 'text-ink-muted' : 'font-semibold text-ink',
                step.state === 'stopped' && 'text-critical',
              )}
            >
              {step.label}
            </span>
            {step.detail ? (
              <span className="text-sm text-ink-muted">
                <bdi>{step.detail}</bdi>
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  )
}
