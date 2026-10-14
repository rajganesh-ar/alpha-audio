import { useId } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING, MOTION } from '../../lib/styles'
import { Icon } from '../Icon/Icon'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  label: string
  name: string
  options: SelectOption[]
  value?: string | undefined
  defaultValue?: string | undefined
  onChange?: ((value: string) => void) | undefined
  /** First, empty option (e.g. "Choose a city"). */
  placeholder?: string | undefined
  /** Shown as the only option, disabled, when `options` is empty. */
  emptyLabel?: string | undefined
  hint?: string | undefined
  error?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  id?: string | undefined
}

/** Native select (keyboard, screen readers and mobile pickers for free), styled to the tokens. */
export function Select({
  label,
  name,
  options,
  value,
  defaultValue,
  onChange,
  placeholder,
  emptyLabel,
  hint,
  error,
  loading = false,
  loadingLabel,
  id,
}: SelectProps) {
  const generated = useId()
  const selectId = id ?? generated
  const hintId = hint ? `${selectId}-hint` : undefined
  const errorId = error ? `${selectId}-error` : undefined
  const empty = options.length === 0
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange ? (e) => onChange(e.currentTarget.value) : undefined}
          disabled={loading || empty}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-busy={loading || undefined}
          className={cx(
            'min-h-11 w-full appearance-none rounded-control border bg-aluminium ps-3 pe-8 text-base text-ink',
            'disabled:cursor-not-allowed disabled:opacity-60',
            FOCUS_RING,
            MOTION,
            error ? 'border-critical' : 'border-line-strong hover:border-ink',
          )}
        >
          {loading ? <option value="">{loadingLabel ?? ''}</option> : null}
          {!loading && empty ? <option value="">{emptyLabel ?? ''}</option> : null}
          {!loading && !empty && placeholder ? <option value="">{placeholder}</option> : null}
          {!loading &&
            options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-ink-muted">
          <Icon name={loading ? 'spinner' : 'chevron-down'} size={16} />
        </span>
      </div>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-center gap-1 text-sm text-critical">
          <Icon name="alert" size={16} />
          {error}
        </p>
      ) : null}
    </div>
  )
}
