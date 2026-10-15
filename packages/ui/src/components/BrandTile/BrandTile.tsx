import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface BrandTileProps {
  name: string
  href: string
  /** The brand's logo (a `next/image` with `fill` in the app). Without one, the name is set as a wordmark. */
  logo?: ReactNode | undefined
  /** Secondary line, e.g. "4 products". */
  meta?: string | undefined
  headingLevel?: 2 | 3 | 4 | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/**
 * A brand in the brand index: logo on a quiet panel (logos never mirror), the name as the link
 * that makes the whole tile clickable, and a count. Logos are shown as supplied, never recoloured.
 */
export function BrandTile({
  name,
  href,
  logo,
  meta,
  headingLevel = 3,
  loading = false,
  loadingLabel,
  error,
}: BrandTileProps) {
  const Heading = `h${headingLevel}` as const
  const shell = 'relative flex h-full flex-col gap-3 rounded-card border border-line p-4'
  if (loading) {
    return (
      <article aria-busy="true" className={shell}>
        <Skeleton shape="block" className="aspect-3/2 w-full rounded-control" />
        <Skeleton lines={1} className="w-1/2" />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </article>
    )
  }
  return (
    <article className={cx(shell, 'hover:border-line-strong')}>
      <div className="relative flex aspect-3/2 items-center justify-center overflow-hidden rounded-control bg-aluminium-deep p-6 [&_img]:object-contain">
        {logo ?? (
          <span
            aria-hidden="true"
            className="text-center font-display text-2xl font-bold text-ink font-stretch-expanded"
          >
            {name}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Heading className="font-display text-lg font-bold text-ink">
          <a
            href={href}
            className={cx(
              'after:absolute after:inset-0 after:rounded-card after:content-[""]',
              FOCUS_RING,
            )}
          >
            {name}
          </a>
        </Heading>
        {error ? (
          <p className="flex items-center gap-2 text-base text-critical">
            <Icon name="alert" />
            {error}
          </p>
        ) : meta ? (
          <p className="text-sm text-ink-muted">{meta}</p>
        ) : null}
      </div>
    </article>
  )
}
