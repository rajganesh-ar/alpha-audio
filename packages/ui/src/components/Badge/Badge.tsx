import { cx } from '../../lib/cx'
import { Icon, type IconName } from '../Icon/Icon'

export type BadgeTone = 'neutral' | 'positive' | 'caution' | 'critical' | 'live'

export interface BadgeProps {
  label?: string | undefined
  tone?: BadgeTone | undefined
  className?: string | undefined
}

const TONE: Record<BadgeTone, { classes: string; icon?: IconName; iconClass?: string }> = {
  neutral: { classes: 'border-line-strong text-ink' },
  positive: {
    classes: 'border-signal-green text-ink',
    icon: 'check',
    iconClass: 'text-signal-green',
  },
  caution: { classes: 'border-bronze text-ink', icon: 'clock', iconClass: 'text-bronze' },
  critical: { classes: 'border-critical text-critical', icon: 'alert' },
  // Live states are the other place amber is spent: a dot on lacquer.
  live: { classes: 'border-lacquer bg-lacquer text-aluminium' },
}

/**
 * Short status label. Every tone pairs its colour with an icon and text, so colour is never
 * the only signal. Renders nothing without a label.
 */
export function Badge({ label, tone = 'neutral', className }: BadgeProps) {
  if (!label) return null
  const t = TONE[tone]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-control border px-2 py-1 text-sm font-semibold',
        t.classes,
        className,
      )}
      data-tone={tone}
    >
      {tone === 'live' ? (
        <span aria-hidden="true" className="size-2 rounded-full bg-vu-amber" />
      ) : null}
      {t.icon ? <Icon name={t.icon} size={16} className={t.iconClass} /> : null}
      {label}
    </span>
  )
}
