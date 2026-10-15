import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Badge } from '../Badge/Badge'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface LeadContact {
  name?: string | undefined
  email?: string | undefined
  phone?: string | undefined
}

export interface LeadCardProps {
  number: string
  /** Product and brand the shopper asked about. */
  product: string
  brand?: string | undefined
  city?: string | undefined
  message?: string | undefined
  /** Received time, formatted. */
  received?: string | undefined
  state: 'offered' | 'accepted' | 'closed'
  stateLabel: string
  /** "Accept by 16 Oct 2026, 10:42 · about 23 hours left": the timer, in words (no JavaScript). */
  deadline?: string | undefined
  /** The deadline is close (under 2 hours) or passed: shown in the critical role. */
  urgent?: boolean | undefined
  /** Only once the company accepted. */
  contact?: LeadContact | undefined
  labels: { city: string; message: string; contact: string; received: string }
  /** Accept and decline, or the outcome form. */
  actions?: ReactNode | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
  emptyLabel?: string | undefined
}

/**
 * A routed lead on the dealer board (spec: LeadCard with acceptance timer). Before acceptance it
 * shows what was asked and where, never who; the deadline is words, not a ticking clock, so it
 * works without JavaScript and reads the same to everyone.
 */
export function LeadCard({
  number,
  product,
  brand,
  city,
  message,
  received,
  state,
  stateLabel,
  deadline,
  urgent = false,
  contact,
  labels,
  actions,
  loading = false,
  loadingLabel,
  error,
  emptyLabel,
}: LeadCardProps) {
  if (loading)
    return (
      <div aria-busy="true" className="flex flex-col gap-3 rounded-card border border-line p-4">
        <Skeleton lines={4} />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </div>
    )
  if (error)
    return (
      <p className="flex items-center gap-2 rounded-card border border-critical p-4 text-critical">
        <Icon name="alert" size={16} />
        {error}
      </p>
    )
  if (!number) return emptyLabel ? <p className="text-base text-ink-muted">{emptyLabel}</p> : null
  return (
    <article
      aria-labelledby={`lead-${number}`}
      className="flex flex-col gap-3 rounded-card border border-line p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {brand ? (
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{brand}</p>
          ) : null}
          <h3 id={`lead-${number}`} className="text-lg font-semibold text-ink">
            {product}
          </h3>
          <p className="font-mono text-sm text-ink-muted">{number}</p>
        </div>
        <Badge
          label={stateLabel}
          tone={state === 'offered' ? 'caution' : state === 'accepted' ? 'positive' : 'neutral'}
        />
      </div>
      {deadline ? (
        <p
          className={cx(
            'flex items-center gap-2 text-sm',
            urgent ? 'font-semibold text-critical' : 'text-ink',
          )}
        >
          <Icon name="clock" size={16} />
          {deadline}
        </p>
      ) : null}
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {city ? (
          <div>
            <dt className="text-ink-muted">{labels.city}</dt>
            <dd className="text-ink">{city}</dd>
          </div>
        ) : null}
        {received ? (
          <div>
            <dt className="text-ink-muted">{labels.received}</dt>
            <dd className="text-ink">
              <bdi>{received}</bdi>
            </dd>
          </div>
        ) : null}
      </dl>
      {message ? (
        <div className="text-sm">
          <p className="text-ink-muted">{labels.message}</p>
          <p className="whitespace-pre-line text-ink">{message}</p>
        </div>
      ) : null}
      {contact ? (
        <div className="rounded-control border border-line-strong p-3 text-sm">
          <p className="font-semibold text-ink">{labels.contact}</p>
          {contact.name ? <p className="text-ink">{contact.name}</p> : null}
          {contact.email ? (
            <p>
              <a
                href={`mailto:${contact.email}`}
                dir="ltr"
                className="inline-flex min-h-11 items-center text-ink underline underline-offset-4"
              >
                {contact.email}
              </a>
            </p>
          ) : null}
          {contact.phone ? (
            <p>
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}
                dir="ltr"
                className="inline-flex min-h-11 items-center text-ink underline underline-offset-4"
              >
                {contact.phone}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </article>
  )
}
