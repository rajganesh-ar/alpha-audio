import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface SpecRow {
  label: string
  /** Already formatted, with units and Western digits, e.g. "200 W per channel". */
  value: string
}

export interface SpecTableProps {
  /** Table caption, also its accessible name, e.g. "Specifications". */
  caption: string
  rows: readonly SpecRow[]
  /** Shown when there are no rows. */
  emptyLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/**
 * Two-column specification table: label as the row header, value with tabular figures. Values use
 * the body face, not the mono data face: the table sits on the product page, and the extra font
 * file would compete with the LCP image for bandwidth (task 0006, Lighthouse budget).
 */
export function SpecTable({
  caption,
  rows,
  emptyLabel,
  loading = false,
  loadingLabel,
  error,
}: SpecTableProps) {
  const heading = <h2 className="font-display text-2xl font-bold text-ink">{caption}</h2>
  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        {heading}
        <Skeleton lines={5} />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </div>
    )
  }
  if (error || rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        {error ? (
          <p className="flex items-center gap-2 text-base text-critical">
            <Icon name="alert" />
            {error}
          </p>
        ) : emptyLabel ? (
          <p className="text-base text-ink-muted">{emptyLabel}</p>
        ) : null}
      </div>
    )
  }
  return (
    <table className="w-full border-collapse text-start">
      <caption className="mb-4 text-start font-display text-2xl font-bold text-ink">
        {caption}
      </caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-line">
            <th
              scope="row"
              className="w-1/2 py-3 pe-4 text-start align-top text-base font-semibold text-ink"
            >
              {row.label}
            </th>
            <td className="py-3 text-start align-top text-base text-ink tabular-nums">
              <bdi>{row.value}</bdi>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
