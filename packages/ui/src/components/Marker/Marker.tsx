import { cx } from '../../lib/cx'

export interface MarkerProps {
  /** Shown in Western digits in every locale. Omit for a plain dot. */
  number?: number | undefined
  /** Accessible name, e.g. "Left speaker, 1". */
  label: string
  /** `critical` marks a placement that fails a hard rule. */
  tone?: 'default' | 'critical' | undefined
  size?: 'sm' | 'md' | undefined
}

/**
 * Numbered amber dot that ties a point on a room plan or diagram to its description.
 * Amber fill with lacquer digits; critical markers use the alert fill with light digits.
 */
export function Marker({ number, label, tone = 'default', size = 'md' }: MarkerProps) {
  return (
    <span
      role="img"
      aria-label={label}
      data-tone={tone}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-mono font-semibold tabular-nums',
        size === 'md' ? 'size-7 text-sm' : 'size-5 text-xs',
        tone === 'critical' ? 'bg-alert text-aluminium' : 'bg-vu-amber text-lacquer',
      )}
    >
      {number !== undefined ? <span aria-hidden="true">{number}</span> : null}
    </span>
  )
}
