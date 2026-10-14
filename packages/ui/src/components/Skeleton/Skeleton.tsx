import { cx } from '../../lib/cx'

export interface SkeletonProps {
  /** `text` draws lines, `block` a rectangle (media, cards), `circle` a dot or avatar. */
  shape?: 'text' | 'block' | 'circle' | undefined
  /** Number of text lines (the last is shorter). Zero renders nothing. */
  lines?: number | undefined
  /** Tailwind sizing classes for `block` and `circle`, e.g. `h-40 w-full`. */
  className?: string | undefined
  /** Stop the pulse, e.g. when a load has stalled behind an error. */
  still?: boolean | undefined
}

/**
 * Placeholder while content loads. Decorative: the region that is loading carries
 * `aria-busy` and a text label, never the skeleton itself.
 */
export function Skeleton({ shape = 'text', lines = 1, className, still = false }: SkeletonProps) {
  const pulse = still ? '' : 'motion-safe:animate-pulse'
  if (shape === 'text') {
    if (lines <= 0) return null
    return (
      <span
        aria-hidden="true"
        className={cx('flex flex-col gap-2', className)}
        data-skeleton="text"
      >
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={cx(
              'block h-3 rounded-control bg-aluminium-deep',
              pulse,
              i === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full',
            )}
          />
        ))}
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      data-skeleton={shape}
      className={cx(
        'block bg-aluminium-deep',
        pulse,
        shape === 'circle' ? 'rounded-full' : 'rounded-card',
        className ?? (shape === 'circle' ? 'size-10' : 'h-24 w-full'),
      )}
    />
  )
}
