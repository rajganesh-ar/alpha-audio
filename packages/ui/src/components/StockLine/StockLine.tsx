import { cx } from '../../lib/cx'
import { Icon, type IconName } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export type StockStatus = 'in-stock' | 'low' | 'out' | 'on-order' | 'unknown'

export interface StockLineProps {
  status: StockStatus
  /** Translated status text, e.g. "In stock". */
  label: string
  /** Delivery or pickup promise, e.g. "Delivered in Dubai tomorrow". */
  detail?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  /** The stock read failed; replaces the status. */
  error?: string | undefined
}

const STATUS: Record<StockStatus, { icon: IconName; iconClass: string }> = {
  'in-stock': { icon: 'check', iconClass: 'text-signal-green' },
  low: { icon: 'clock', iconClass: 'text-bronze' },
  out: { icon: 'close', iconClass: 'text-critical' },
  'on-order': { icon: 'truck', iconClass: 'text-ink-muted' },
  unknown: { icon: 'info', iconClass: 'text-ink-muted' },
}

/**
 * Static stock line: icon, status and promise. Text stays ink (green and bronze fail 4.5:1 as
 * text on aluminium), so the colour sits on the icon and the words carry the meaning. The
 * live variant, streamed from the ledger, arrives with the stock task.
 */
export function StockLine({
  status,
  label,
  detail,
  loading = false,
  loadingLabel,
  error,
}: StockLineProps) {
  if (loading) {
    return (
      <p aria-busy="true" className="flex items-center gap-2" data-state="loading">
        <Skeleton shape="circle" className="size-5" />
        <Skeleton lines={1} className="w-40" />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </p>
    )
  }
  if (error) {
    return (
      <p className="flex items-center gap-2 text-base text-critical" data-state="error">
        <Icon name="alert" />
        {error}
      </p>
    )
  }
  const s = STATUS[status]
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-base text-ink" data-status={status}>
      <Icon name={s.icon} className={cx(s.iconClass)} />
      <span className="font-semibold">{label}</span>
      {detail ? <span className="text-ink-muted">{detail}</span> : null}
    </p>
  )
}
