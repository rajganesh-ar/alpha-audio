import type { ReactNode } from 'react'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface CheckoutSectionProps {
  step: number
  title: string
  description?: string | undefined
  /** The section's fields. */
  children?: ReactNode | undefined
  /** Shown when the section has nothing to fill in (e.g. no payment methods). */
  emptyLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  /** A problem with the section as a whole (field errors stay on the fields). */
  error?: string | undefined
}

/**
 * One step of the one-page checkout: a fieldset whose legend carries the step number, so the
 * fields are grouped for screen readers and the order reads the same in both directions.
 */
export function CheckoutSection({
  step,
  title,
  description,
  children,
  emptyLabel,
  loading = false,
  loadingLabel,
  error,
}: CheckoutSectionProps) {
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-4 rounded-card border border-line p-6"
      aria-busy={loading || undefined}
    >
      <legend className="flex items-center gap-3 px-2 font-display text-xl font-bold text-ink">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-lacquer text-sm text-aluminium tabular-nums"
        >
          {step}
        </span>
        {title}
      </legend>
      {description ? <p className="text-base text-ink-muted">{description}</p> : null}
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-base text-critical">
          <Icon name="alert" />
          {error}
        </p>
      ) : null}
      {loading ? (
        <>
          <Skeleton lines={3} />
          {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
        </>
      ) : children ? (
        <div className="flex flex-col gap-4">{children}</div>
      ) : emptyLabel ? (
        <p className="text-base text-ink-muted">{emptyLabel}</p>
      ) : null}
    </fieldset>
  )
}
