import { Button } from '../Button/Button'
import { Icon } from '../Icon/Icon'
import { Input } from '../Input/Input'
import { Skeleton } from '../Skeleton/Skeleton'

export interface ProjectFormValues {
  name?: string | undefined
  endCustomer?: string | undefined
  city?: string | undefined
  expectedClose?: string | undefined
  note?: string | undefined
  lines?: ReadonlyArray<{ sku: string; qty: string }> | undefined
}

export interface ProjectRegistrationFormProps {
  action: string
  labels: {
    project: string
    name: string
    endCustomer: string
    city: string
    expectedClose: string
    note: string
    products: string
    /** With `{n}`, e.g. "Line {n}". */
    line: string
    sku: string
    qty: string
    submit: string
    required: string
  }
  /** Hidden fields, e.g. the idempotency key. */
  hidden?: Readonly<Record<string, string>> | undefined
  values?: ProjectFormValues | undefined
  /** Field problems, already translated, by field name (`name`, `endCustomer`, `expectedClose`, `lines`). */
  errors?: Readonly<Record<string, string>> | undefined
  hint?: string | undefined
  blankRows?: number | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/**
 * Project registration (spec: ProjectRegistrationForm): the project, its end customer, site and
 * expected close, and the products and quantities. A plain POST form, no JavaScript; each
 * product line is its own group so repeated fields stay distinct for assistive technology.
 */
export function ProjectRegistrationForm({
  action,
  labels,
  hidden = {},
  values = {},
  errors = {},
  hint,
  blankRows = 3,
  loading = false,
  loadingLabel,
  error,
}: ProjectRegistrationFormProps) {
  if (loading)
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton lines={6} />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </div>
    )
  const rows = [
    ...(values.lines ?? []),
    ...Array.from({ length: blankRows }, () => ({ sku: '', qty: '' })),
  ]
  return (
    <form method="post" action={action} className="flex flex-col gap-6">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-critical">
          <Icon name="alert" size={16} />
          {error}
        </p>
      ) : null}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold text-ink">{labels.project}</legend>
        {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
        <Input
          label={labels.name}
          name="name"
          defaultValue={values.name}
          required
          requiredLabel={labels.required}
          maxLength={120}
          error={errors['name']}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={labels.endCustomer}
            name="endCustomer"
            defaultValue={values.endCustomer}
            required
            requiredLabel={labels.required}
            maxLength={120}
            error={errors['endCustomer']}
          />
          <Input label={labels.city} name="city" defaultValue={values.city} maxLength={80} />
        </div>
        <Input
          label={labels.expectedClose}
          name="expectedClose"
          type="date"
          defaultValue={values.expectedClose}
          required
          requiredLabel={labels.required}
          dir="ltr"
          error={errors['expectedClose']}
        />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink">{labels.note}</span>
          <textarea
            name="note"
            rows={3}
            maxLength={1000}
            defaultValue={values.note}
            className="w-full rounded-control border border-line-strong bg-transparent px-3 py-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </label>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold text-ink">{labels.products}</legend>
        {errors['lines'] ? (
          <p className="flex items-center gap-2 text-sm text-critical">
            <Icon name="alert" size={16} />
            {errors['lines']}
          </p>
        ) : null}
        {rows.map((row, i) => (
          <fieldset key={i} className="grid grid-cols-[1fr_8rem] items-start gap-3">
            <legend className="sr-only">{labels.line.replace('{n}', String(i + 1))}</legend>
            <Input label={labels.sku} name="sku" defaultValue={row.sku} maxLength={64} dir="ltr" />
            <Input
              label={labels.qty}
              name="qty"
              type="number"
              inputMode="numeric"
              defaultValue={row.qty}
              dir="ltr"
            />
          </fieldset>
        ))}
      </fieldset>
      <div>
        <Button type="submit" icon="arrow-forward" iconPosition="end">
          {labels.submit}
        </Button>
      </div>
    </form>
  )
}
