import { cx } from '../../lib/cx'
import { FOCUS_RING, MOTION } from '../../lib/styles'
import { Icon } from '../Icon/Icon'

export interface ChipProps {
  label: string
  /** Toggle state, announced as pressed. */
  selected?: boolean | undefined
  /** Result count shown after the label; 0 disables the chip. */
  count?: number | undefined
  /** The option cannot apply (for example it conflicts with another choice). */
  invalid?: boolean | undefined
  invalidLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  onToggle?: ((selected: boolean) => void) | undefined
}

/** Filter and intent chip: a toggle button with a 44 px target. */
export function Chip({
  label,
  selected = false,
  count,
  invalid = false,
  invalidLabel,
  loading = false,
  loadingLabel,
  onToggle,
}: ChipProps) {
  const disabled = loading || count === 0
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-busy={loading || undefined}
      disabled={disabled}
      onClick={() => onToggle?.(!selected)}
      className={cx(
        'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold',
        'disabled:cursor-not-allowed disabled:opacity-60',
        FOCUS_RING,
        MOTION,
        invalid
          ? 'border-critical text-critical'
          : selected
            ? 'border-lacquer bg-lacquer text-aluminium'
            : 'border-line-strong text-ink hover:border-ink',
      )}
    >
      {loading ? (
        <Icon name="spinner" size={16} />
      ) : selected ? (
        <Icon name="check" size={16} />
      ) : invalid ? (
        <Icon name="alert" size={16} />
      ) : null}
      <span>{label}</span>
      {count !== undefined ? <span className="font-mono text-xs tabular-nums">{count}</span> : null}
      {invalid && invalidLabel ? <span className="sr-only">{invalidLabel}</span> : null}
      {loading && loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
    </button>
  )
}
