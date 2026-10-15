import { cx } from '../../lib/cx'
import { FOCUS_RING, TARGET } from '../../lib/styles'
import { Button } from '../Button/Button'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface FacetOption {
  value: string
  label: string
  /** Matching products with every other filter applied; omitted for "any" options. */
  count?: number | undefined
  checked: boolean
}

export interface FacetGroup {
  id: string
  legend: string
  /** Query parameter, e.g. `brand` or `spec.channels`. */
  name: string
  /** `checkbox` for any-of values, `radio` for one choice (include an "any" option). */
  type: 'checkbox' | 'radio'
  options: FacetOption[]
}

export interface FacetRailProps {
  /** The form's id; `SortMenu` binds to it with `form`. */
  formId: string
  /** URL the filters submit to (the unfiltered listing). */
  action: string
  title: string
  /** Disclosure label on small screens, e.g. "Filters (2)". */
  toggleLabel: string
  groups: FacetGroup[]
  applyLabel: string
  clearLabel?: string | undefined
  /** Shown when any filter is active. */
  clearHref?: string | undefined
  /** Shown when there is nothing to filter by. */
  emptyLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/**
 * Listing filters as a plain GET form: works without JavaScript, and nothing happens until
 * Apply is pressed (WCAG 3.2.2, no change of context on input). Below `lg` it is a disclosure;
 * from `lg` it is always open, through `::details-content` where the browser supports it (the
 * summary hides only there, so older browsers keep a working toggle).
 */
export function FacetRail({
  formId,
  action,
  title,
  toggleLabel,
  groups,
  applyLabel,
  clearLabel,
  clearHref,
  emptyLabel,
  loading = false,
  loadingLabel,
  error,
}: FacetRailProps) {
  const body = () => {
    if (loading) {
      return (
        <div aria-busy="true" className="flex flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton lines={1} className="w-1/3" />
              <Skeleton lines={3} />
            </div>
          ))}
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
    if (groups.length === 0)
      return emptyLabel ? <p className="text-base text-ink-muted">{emptyLabel}</p> : null
    return (
      <form id={formId} method="get" action={action} className="flex flex-col gap-6">
        {groups.map((group) => (
          <fieldset key={group.id} className="flex flex-col gap-1">
            <legend className="mb-2 text-sm font-semibold tracking-wide text-ink uppercase">
              {group.legend}
            </legend>
            {group.options.map((option) => {
              const id = `${formId}-${group.id}-${option.value || 'any'}`
              return (
                <label
                  key={option.value}
                  htmlFor={id}
                  className={cx(
                    'flex cursor-pointer items-center gap-3 rounded-control px-1 text-base text-ink',
                    TARGET,
                  )}
                >
                  <input
                    id={id}
                    type={group.type}
                    name={group.name}
                    value={option.value}
                    defaultChecked={option.checked}
                    className={cx('size-5 shrink-0 accent-lacquer', FOCUS_RING)}
                  />
                  <span className="flex-1">{option.label}</span>
                  {option.count !== undefined ? (
                    <span className="text-sm text-ink-muted tabular-nums">{option.count}</span>
                  ) : null}
                </label>
              )
            })}
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary">
            {applyLabel}
          </Button>
          {clearHref && clearLabel ? (
            <Button href={clearHref} variant="quiet">
              {clearLabel}
            </Button>
          ) : null}
        </div>
      </form>
    )
  }

  return (
    <details
      className={cx(
        'group rounded-card border border-line lg:border-0',
        'lg:[&::details-content]:block lg:[&::details-content]:[content-visibility:visible]',
      )}
    >
      <summary
        className={cx(
          'flex cursor-pointer list-none items-center justify-between gap-3 rounded-card px-4 font-semibold text-ink [&::-webkit-details-marker]:hidden',
          'lg:supports-[selector(::details-content)]:hidden',
          TARGET,
          FOCUS_RING,
        )}
      >
        {toggleLabel}
        <Icon name="chevron-down" className="group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 p-4 lg:p-0">
        <h2 className="hidden font-display text-lg font-bold text-ink lg:block">{title}</h2>
        {body()}
      </div>
    </details>
  )
}
