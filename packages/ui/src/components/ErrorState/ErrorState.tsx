import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Icon } from '../Icon/Icon'

export interface ErrorStateProps {
  title: string
  body?: string | undefined
  /** Usually a critical secondary Button ("Try again"). */
  action?: ReactNode | undefined
  /** Support reference, shown in mono so customers can read it out. */
  reference?: { label: string; code: string } | undefined
  /** Announce immediately (`role="alert"`) when it replaces content after a user action. */
  live?: boolean | undefined
  compact?: boolean | undefined
}

/** A part of the page failed. Says what happened and offers the way forward. */
export function ErrorState({
  title,
  body,
  action,
  reference,
  live = false,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role={live ? 'alert' : undefined}
      className={cx(
        'flex flex-col items-start gap-3 text-ink',
        compact ? '' : 'rounded-card border border-critical p-6',
      )}
      data-state="error"
    >
      <p className="flex items-center gap-2 font-display text-lg font-bold">
        <Icon name="alert" className="text-critical" />
        {title}
      </p>
      {body ? <p className="text-base text-ink-muted">{body}</p> : null}
      {reference ? (
        <p className="text-sm text-ink-muted">
          {reference.label}{' '}
          <code dir="ltr" className="font-mono text-ink">
            {reference.code}
          </code>
        </p>
      ) : null}
      {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </div>
  )
}
