import { useId } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface PaymentMethodOption {
  value: string
  label: string
  description?: string | undefined
}

export interface PaymentMethodListProps {
  /** Accessible name of the radio group. */
  label: string
  name: string
  options: readonly PaymentMethodOption[]
  /** The chosen method (from the saved draft). */
  value?: string | undefined
  emptyLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/**
 * The market's payment methods the provider can take, as large radio cards (one tap target per
 * method). Which methods appear is data (Markets record ∩ provider), never a branch here.
 */
export function PaymentMethodList({
  label,
  name,
  options,
  value,
  emptyLabel,
  loading = false,
  loadingLabel,
  error,
}: PaymentMethodListProps) {
  const id = useId()
  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton shape="block" className="h-16 w-full rounded-card" />
        <Skeleton shape="block" className="h-16 w-full rounded-card" />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </div>
    )
  }
  if (options.length === 0)
    return emptyLabel ? <p className="text-base text-ink-muted">{emptyLabel}</p> : null
  // A single method is preselected; with several the shopper chooses (unless one was chosen before).
  const selected = value ?? (options.length === 1 ? options[0]?.value : undefined)
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={error ? `${id}-error` : undefined}
      className="flex flex-col gap-3"
    >
      {options.map((option) => {
        const optionId = `${id}-${option.value}`
        return (
          <label
            key={option.value}
            htmlFor={optionId}
            className={cx(
              'flex min-h-16 cursor-pointer items-center gap-4 rounded-card border px-4 py-3 has-checked:border-lacquer',
              error ? 'border-critical' : 'border-line-strong hover:border-ink',
            )}
          >
            <input
              id={optionId}
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === selected}
              required
              className={cx('size-5 shrink-0 accent-lacquer', FOCUS_RING)}
            />
            <span className="flex flex-col">
              <span className="text-base font-semibold text-ink">{option.label}</span>
              {option.description ? (
                <span className="text-sm text-ink-muted">{option.description}</span>
              ) : null}
            </span>
          </label>
        )
      })}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-2 text-sm text-critical">
          <Icon name="alert" />
          {error}
        </p>
      ) : null}
    </div>
  )
}
