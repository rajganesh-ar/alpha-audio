import { useId } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING, MOTION } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface SortMenuProps {
  label: string
  /** Query parameter, normally `sort`. */
  name: string
  options: Array<{ value: string; label: string }>
  value: string
  /** The filter form's id, so a new order keeps the active filters. */
  form: string
  submitLabel: string
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/**
 * Sort order for a listing: a labelled native select bound to the filter form, with its own
 * submit button (choosing an option does not reload the page by itself, WCAG 3.2.2).
 */
export function SortMenu({
  label,
  name,
  options,
  value,
  form,
  submitLabel,
  loading = false,
  loadingLabel,
  error,
}: SortMenuProps) {
  const id = useId()
  if (loading) {
    return (
      <div aria-busy="true" className="flex items-end gap-2">
        <Skeleton shape="block" className="h-11 w-48 rounded-control" />
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
  if (options.length === 0) return null
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        <div className="relative">
          <select
            id={id}
            name={name}
            form={form}
            defaultValue={value}
            className={cx(
              'min-h-11 appearance-none rounded-control border border-line-strong bg-aluminium ps-3 pe-8 text-base text-ink hover:border-ink',
              FOCUS_RING,
              MOTION,
            )}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-down"
            className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-ink-muted"
          />
        </div>
      </div>
      <button
        type="submit"
        form={form}
        className={cx(
          'min-h-11 rounded-control border border-ink px-4 font-semibold text-ink hover:bg-ink hover:text-aluminium',
          FOCUS_RING,
          MOTION,
        )}
      >
        {submitLabel}
      </button>
    </div>
  )
}
