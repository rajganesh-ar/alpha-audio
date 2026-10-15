import type { ReactNode } from 'react'
import { Icon } from '@alpha/ui'

export interface OrderLineView {
  sku: string
  title: string
  qty: number
  unit?: string | undefined
  total?: string | undefined
  /** A problem or status note for the line, already translated. */
  note?: string | undefined
  critical?: boolean | undefined
  trace?: ReactNode | undefined
}

/** The lines of a dealer order or its review: product, quantity, net unit and net line. */
export function OrderLines({
  caption,
  columns,
  lines,
}: {
  caption: string
  columns: { product: string; qty: string; unit: string; total: string }
  lines: readonly OrderLineView[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-base">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line-strong text-sm text-ink-muted">
            <th scope="col" className="py-2 pe-4 text-start font-semibold">
              {columns.product}
            </th>
            <th scope="col" className="py-2 pe-4 text-end font-semibold">
              {columns.qty}
            </th>
            <th scope="col" className="py-2 pe-4 text-end font-semibold">
              {columns.unit}
            </th>
            <th scope="col" className="py-2 text-end font-semibold">
              {columns.total}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.sku} className="border-b border-line align-top">
              <th scope="row" className="py-3 pe-4 text-start font-normal">
                <span className="block font-semibold text-ink">{line.title}</span>
                <span className="block font-mono text-sm text-ink-muted">{line.sku}</span>
                {line.note ? (
                  <span
                    className={`mt-1 flex items-center gap-1 text-sm ${line.critical ? 'text-critical' : 'text-ink-muted'}`}
                  >
                    <Icon name={line.critical ? 'alert' : 'info'} size={16} />
                    {line.note}
                  </span>
                ) : null}
                {line.trace ? <div className="mt-1">{line.trace}</div> : null}
              </th>
              <td className="py-3 pe-4 text-end text-ink tabular-nums">{line.qty}</td>
              <td className="py-3 pe-4 text-end text-ink tabular-nums">
                {line.unit ? <bdi>{line.unit}</bdi> : '—'}
              </td>
              <td className="py-3 text-end font-semibold text-ink tabular-nums">
                {line.total ? <bdi>{line.total}</bdi> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
