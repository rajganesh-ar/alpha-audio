import { Button } from '../Button/Button'
import { Icon } from '../Icon/Icon'
import { Input } from '../Input/Input'
import { Skeleton } from '../Skeleton/Skeleton'

export interface QuickOrderRow {
  sku: string
  qty: string
  /** Why this line cannot be ordered, already translated. */
  error?: string | undefined
}

export interface QuickOrderProps {
  /** Where the form goes (a GET review page, so it works without JavaScript). */
  action: string
  legend: string
  rows: readonly QuickOrderRow[]
  /** Empty rows after the filled ones, for more lines. */
  blankRows?: number | undefined
  /** Each line's group name with `{n}`, e.g. "Line {n}". */
  lineLabel: string
  skuLabel: string
  qtyLabel: string
  submitLabel: string
  hint?: string | undefined
  /** Carried through the review, e.g. the project the order is for. */
  hidden?: Readonly<Record<string, string>> | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/**
 * Quick order (spec: QuickOrder): SKU and quantity rows submitted together for a priced review.
 * Each line is its own group ("Line 2: SKU, Quantity") so the repeated fields stay distinct for
 * assistive technology. Plain form fields: no JavaScript needed.
 */
export function QuickOrder({
  action,
  legend,
  rows,
  blankRows = 3,
  lineLabel,
  skuLabel,
  qtyLabel,
  submitLabel,
  hint,
  hidden = {},
  loading = false,
  loadingLabel,
  error,
}: QuickOrderProps) {
  const all: QuickOrderRow[] = [
    ...rows,
    ...Array.from({ length: blankRows }, () => ({ sku: '', qty: '' })),
  ]
  return (
    <form
      method="get"
      action={action}
      className="flex flex-col gap-4"
      aria-busy={loading || undefined}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold text-ink">{legend}</legend>
        {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
        {error ? (
          <p className="flex items-center gap-2 text-sm text-critical" role="alert">
            <Icon name="alert" size={16} />
            {error}
          </p>
        ) : null}
        {loading ? (
          <>
            <Skeleton lines={3} />
            {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
          </>
        ) : (
          all.map((row, i) => (
            <fieldset key={i} className="grid grid-cols-[1fr_8rem] items-start gap-3">
              <legend className="sr-only">{lineLabel.replace('{n}', String(i + 1))}</legend>
              <Input
                label={skuLabel}
                name="sku"
                defaultValue={row.sku}
                maxLength={64}
                autoComplete="off"
                dir="ltr"
                error={row.error}
              />
              <Input
                label={qtyLabel}
                name="qty"
                type="number"
                inputMode="numeric"
                defaultValue={row.qty}
                maxLength={6}
                dir="ltr"
              />
            </fieldset>
          ))
        )}
      </fieldset>
      <div>
        <Button type="submit" variant="secondary" icon="arrow-forward" iconPosition="end">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
