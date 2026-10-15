import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface BagLineProps {
  title: string
  href: string
  brand?: string | undefined
  /** Thumbnail (a `next/image` with `fill` in the app). */
  media?: ReactNode | undefined
  /** Already formatted with `formatMoney`, e.g. "AED 34,500.00 each". */
  unitPrice?: string | undefined
  /** Already formatted line total. */
  lineTotal?: string | undefined
  /** Quantity control (a small form in the app). */
  quantity?: ReactNode | undefined
  /** Remove control. */
  remove?: ReactNode | undefined
  /** A message about this line: a price change, or that it can no longer be bought. */
  notice?: string | undefined
  noticeTone?: 'info' | 'critical' | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/** One product in the bag: thumbnail, name, unit price, quantity, line total, remove. */
export function BagLine({
  title,
  href,
  brand,
  media,
  unitPrice,
  lineTotal,
  quantity,
  remove,
  notice,
  noticeTone = 'info',
  loading = false,
  loadingLabel,
  error,
}: BagLineProps) {
  const shell =
    'grid grid-cols-[5rem_1fr] gap-4 border-b border-line py-4 sm:grid-cols-[6rem_1fr_auto]'
  if (loading) {
    return (
      <div aria-busy="true" className={shell}>
        <Skeleton shape="block" className="aspect-square w-full rounded-control" />
        <div className="flex flex-col gap-2">
          <Skeleton lines={2} />
        </div>
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </div>
    )
  }
  return (
    <article className={shell}>
      <div className="relative aspect-square overflow-hidden rounded-control bg-aluminium-deep [&_img]:object-contain">
        {media ?? (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-ink-muted"
          >
            <Icon name="image" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {brand ? (
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{brand}</p>
        ) : null}
        <h3 className="font-display text-base font-bold text-ink">
          <a href={href} className={cx('underline-offset-4 hover:underline', FOCUS_RING)}>
            {title}
          </a>
        </h3>
        {unitPrice ? <p className="text-sm text-ink-muted tabular-nums">{unitPrice}</p> : null}
        {error ? (
          <p className="flex items-center gap-2 text-sm text-critical">
            <Icon name="alert" />
            {error}
          </p>
        ) : notice ? (
          <p
            className={cx(
              'flex items-center gap-2 text-sm',
              noticeTone === 'critical' ? 'text-critical' : 'text-ink',
            )}
          >
            <Icon name={noticeTone === 'critical' ? 'alert' : 'info'} />
            {notice}
          </p>
        ) : null}
        {quantity || remove ? (
          <div className="mt-2 flex flex-wrap items-end gap-3">
            {quantity}
            {remove}
          </div>
        ) : null}
      </div>
      {lineTotal ? (
        <p className="col-start-2 font-display text-lg font-bold text-ink tabular-nums sm:col-start-3 sm:text-end">
          {lineTotal}
        </p>
      ) : null}
    </article>
  )
}
