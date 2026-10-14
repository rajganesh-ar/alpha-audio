import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Icon, type IconName } from '../Icon/Icon'

export interface EmptyStateProps {
  title: string
  body?: string | undefined
  icon?: IconName | undefined
  /** The way forward: a Button or a link. */
  action?: ReactNode | undefined
  /** Secondary note, e.g. why an action could not complete. */
  note?: ReactNode | undefined
  align?: 'start' | 'center' | undefined
}

/** Nothing to show yet, and what to do about it. */
export function EmptyState({
  title,
  body,
  icon = 'search',
  action,
  note,
  align = 'center',
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col gap-3 rounded-card border border-dashed border-line-strong p-8 text-ink',
        align === 'center' ? 'items-center text-center' : 'items-start text-start',
      )}
      data-state="empty"
    >
      <Icon name={icon} size={32} className="text-ink-muted" />
      <p className="font-display text-lg font-bold">{title}</p>
      {body ? <p className="max-w-prose text-base text-ink-muted">{body}</p> : null}
      {action ? <div className="flex flex-wrap justify-center gap-3">{action}</div> : null}
      {note}
    </div>
  )
}
