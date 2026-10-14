import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Skeleton } from '../Skeleton/Skeleton'

export interface CardProps {
  title?: string | undefined
  /** Heading level for the title within the page outline. */
  headingLevel?: 2 | 3 | 4 | undefined
  eyebrow?: string | undefined
  /** Media slot (a next/image in the app), shown above the text. */
  media?: ReactNode | undefined
  children?: ReactNode | undefined
  footer?: ReactNode | undefined
  /** Makes the title a link; the whole card becomes clickable through it. */
  href?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  className?: string | undefined
}

/** Content card: 8 px radius, hairline border, optional media and footer. */
export function Card({
  title,
  headingLevel = 3,
  eyebrow,
  media,
  children,
  footer,
  href,
  loading = false,
  loadingLabel,
  className,
}: CardProps) {
  const Heading = `h${headingLevel}` as const
  if (loading) {
    return (
      <article
        aria-busy="true"
        className={cx('flex flex-col gap-3 rounded-card border border-line p-4', className)}
      >
        <Skeleton shape="block" className="aspect-4/3 w-full" />
        <Skeleton lines={1} className="w-2/3" />
        <Skeleton lines={2} />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </article>
    )
  }
  return (
    <article
      className={cx(
        'relative flex flex-col gap-3 rounded-card border border-line p-4',
        href && 'hover:border-line-strong',
        className,
      )}
    >
      {media ? (
        <div className="overflow-hidden rounded-control bg-aluminium-deep">{media}</div>
      ) : null}
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{eyebrow}</p>
      ) : null}
      {title ? (
        <Heading className="font-display text-lg font-bold text-ink">
          {href ? (
            <a
              href={href}
              className={cx('after:absolute after:inset-0 after:content-[""]', FOCUS_RING)}
            >
              {title}
            </a>
          ) : (
            title
          )}
        </Heading>
      ) : null}
      {children ? <div className="text-base text-ink">{children}</div> : null}
      {footer ? (
        <div className="relative mt-auto flex flex-wrap items-center gap-3 pt-2">{footer}</div>
      ) : null}
    </article>
  )
}
