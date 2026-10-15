import { useId, type HTMLInputAutoCompleteAttribute } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING, MOTION } from '../../lib/styles'
import { Icon } from '../Icon/Icon'

export interface InputProps {
  label: string
  name: string
  value?: string | undefined
  defaultValue?: string | undefined
  onChange?: ((value: string) => void) | undefined
  type?: 'text' | 'email' | 'tel' | 'search' | 'url' | 'password' | 'number' | 'date' | undefined
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'search' | 'url' | undefined
  autoComplete?: HTMLInputAutoCompleteAttribute | undefined
  placeholder?: string | undefined
  hint?: string | undefined
  /** Error message; marks the field invalid and is read with it. */
  error?: string | undefined
  required?: boolean | undefined
  maxLength?: number | undefined
  requiredLabel?: string | undefined
  /** Validating in the background (an address lookup, a VAT number check). */
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  /** Force a direction for values that are always LTR (phone numbers, codes, emails). */
  dir?: 'ltr' | 'rtl' | undefined
  id?: string | undefined
}

/** Text field with its label, hint and error tied to it (`aria-describedby`). */
export function Input({
  label,
  name,
  value,
  defaultValue,
  onChange,
  type = 'text',
  inputMode,
  autoComplete,
  placeholder,
  hint,
  error,
  required = false,
  maxLength,
  requiredLabel,
  loading = false,
  loadingLabel,
  dir,
  id,
}: InputProps) {
  const generated = useId()
  const inputId = id ?? generated
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const statusId = loading && loadingLabel ? `${inputId}-status` : undefined
  const describedBy = [hintId, errorId, statusId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        {label}
        {required && requiredLabel ? (
          <span className="ms-1 font-normal text-ink-muted">({requiredLabel})</span>
        ) : null}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange ? (e) => onChange(e.currentTarget.value) : undefined}
          required={required}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-busy={loading || undefined}
          dir={dir}
          className={cx(
            'min-h-11 w-full rounded-control border bg-transparent px-3 text-base text-ink placeholder:text-ink-muted',
            FOCUS_RING,
            MOTION,
            loading && 'pe-8',
            error ? 'border-critical' : 'border-line-strong hover:border-ink',
          )}
        />
        {loading ? (
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-ink-muted">
            <Icon name="spinner" size={16} />
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {statusId ? (
        <p id={statusId} className="text-sm text-ink-muted" role="status">
          {loadingLabel}
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
