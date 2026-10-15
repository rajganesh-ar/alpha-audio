import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface PartnerCatalogueRow {
  sku: string
  title: string
  brand?: string | undefined
  /** RRP incl. VAT, formatted; the consumer price for reference. */
  rrp?: string | undefined
  /** The company's own net price, formatted; absent when the product cannot be bought. */
  price?: string | undefined
  /** `needs-approval`: below the margin floor; ordering it opens a request. */
  status: 'ok' | 'needs-approval' | 'unavailable'
  /** Stock as the company may see it (exact, banded), or absent when hidden. */
  stock?: string | undefined
  /** "Why this price" (a PriceTraceDrawer). */
  trace?: ReactNode | undefined
  /** Starts an order with this product (a link to the quick order review). */
  orderHref?: string | undefined
}

export interface PartnerCatalogueTableProps {
  caption: string
  columns: { product: string; rrp: string; price: string; stock: string }
  rows: readonly PartnerCatalogueRow[]
  statusLabels: { 'needs-approval': string; unavailable: string }
  emptyLabel?: string | undefined
  /** Visible text of each row's order link, e.g. "Order"; the product name is added for screen readers. */
  orderLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/**
 * The dealer catalogue (spec: PartnerCatalogueTable): product, RRP, the company's own price
 * with its trace, and stock per the company's visibility setting. A real table (caption,
 * header cells), scrolling sideways on small screens; amounts in `<bdi>` for Arabic.
 */
export function PartnerCatalogueTable({
  caption,
  columns,
  rows,
  statusLabels,
  emptyLabel,
  orderLabel,
  loading = false,
  loadingLabel,
  error,
}: PartnerCatalogueTableProps) {
  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} shape="block" className="h-12 w-full rounded-control" />
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
  if (rows.length === 0)
    return emptyLabel ? <p className="text-base text-ink-muted">{emptyLabel}</p> : null
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
              {columns.rrp}
            </th>
            <th scope="col" className="py-2 pe-4 text-end font-semibold">
              {columns.price}
            </th>
            <th scope="col" className="py-2 text-end font-semibold">
              {columns.stock}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sku} className="border-b border-line align-top">
              <th scope="row" className="py-3 pe-4 text-start font-normal">
                {row.brand ? (
                  <span className="block text-xs font-semibold tracking-wide text-ink-muted uppercase">
                    {row.brand}
                  </span>
                ) : null}
                <span className="block font-semibold text-ink">{row.title}</span>
                <span className="block font-mono text-sm text-ink-muted">{row.sku}</span>
                {row.orderHref && orderLabel ? (
                  <a
                    href={row.orderHref}
                    className={cx(
                      'mt-1 inline-flex min-h-11 items-center gap-1 rounded-control text-sm font-semibold text-ink underline underline-offset-4',
                      FOCUS_RING,
                    )}
                  >
                    {orderLabel}
                    <span className="sr-only">: {row.title}</span>
                    <Icon name="arrow-forward" size={16} />
                  </a>
                ) : null}
              </th>
              <td className="py-3 pe-4 text-end text-ink-muted tabular-nums">
                {row.rrp ? <bdi>{row.rrp}</bdi> : '—'}
              </td>
              <td className="py-3 pe-4 text-end">
                {row.price ? (
                  <bdi className="block font-semibold text-ink tabular-nums">{row.price}</bdi>
                ) : null}
                {row.status !== 'ok' ? (
                  <span
                    className={cx(
                      'flex items-center justify-end gap-1 text-sm',
                      row.status === 'unavailable' ? 'text-ink-muted' : 'text-critical',
                    )}
                  >
                    <Icon name={row.status === 'unavailable' ? 'close' : 'alert'} size={16} />
                    {statusLabels[row.status]}
                  </span>
                ) : null}
                {row.trace ? <div className="flex justify-end">{row.trace}</div> : null}
              </td>
              <td className="py-3 text-end text-ink tabular-nums">{row.stock ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
