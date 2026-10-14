import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface ProductCardProps {
  title: string
  href: string
  brand?: string | undefined
  /** Lead image (a `next/image` with `fill` and `sizes` in the app). */
  media?: ReactNode | undefined
  /** A `PriceBlock`; the card never formats or computes a price. */
  price?: ReactNode | undefined
  /** A `StockLine`. */
  stock?: ReactNode | undefined
  headingLevel?: 2 | 3 | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  /** Price or stock could not be read; replaces both. */
  error?: string | undefined
}

/**
 * Product in a grid: lead image at 4:3 (reserved before it loads, so nothing shifts), brand,
 * title as the link that makes the whole card clickable, then price and stock.
 */
export function ProductCard({
  title,
  href,
  brand,
  media,
  price,
  stock,
  headingLevel = 3,
  loading = false,
  loadingLabel,
  error,
}: ProductCardProps) {
  const Heading = `h${headingLevel}` as const
  const shell = 'relative flex h-full flex-col gap-3 rounded-card border border-line p-4'
  if (loading) {
    return (
      <article aria-busy="true" className={shell}>
        <Skeleton shape="block" className="aspect-4/3 w-full rounded-control" />
        <Skeleton lines={1} className="w-1/3" />
        <Skeleton lines={1} className="w-2/3" />
        <Skeleton shape="block" className="h-7 w-32 rounded-control" />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </article>
    )
  }
  return (
    <article className={cx(shell, 'hover:border-line-strong')}>
      <div className="relative aspect-4/3 overflow-hidden rounded-control bg-aluminium-deep [&_img]:object-contain">
        {media ?? (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-ink-muted"
          >
            <Icon name="image" className="size-8" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {brand ? (
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{brand}</p>
        ) : null}
        <Heading className="font-display text-lg font-bold text-ink">
          <a
            href={href}
            className={cx(
              'after:absolute after:inset-0 after:rounded-card after:content-[""]',
              FOCUS_RING,
            )}
          >
            {title}
          </a>
        </Heading>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        {error ? (
          <p className="flex items-center gap-2 text-base text-critical">
            <Icon name="alert" />
            {error}
          </p>
        ) : (
          <>
            {price}
            {stock}
          </>
        )}
      </div>
    </article>
  )
}
