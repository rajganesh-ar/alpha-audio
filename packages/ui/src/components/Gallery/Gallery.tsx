'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING, TARGET } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface GallerySlide {
  id: string
  /** The image (a `next/image` with `fill` and `sizes`; the first one `priority`). */
  media: ReactNode
  /** Small version for the thumbnail strip. */
  thumb?: ReactNode | undefined
}

export interface GalleryProps {
  /** Accessible name of the gallery, e.g. "Product images". */
  label: string
  slides: readonly GallerySlide[]
  /** Thumbnail button name with `{index}` and `{total}`, e.g. "Show image {index} of {total}". */
  thumbnailLabel: string
  emptyLabel?: string | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

const fill = (template: string, index: number, total: number) =>
  template.replace('{index}', String(index)).replace('{total}', String(total))

/**
 * Product images: a scroll-snapping strip (swipe on touch, scroll with the keyboard) and a row
 * of thumbnails that bring an image into view. Works without JavaScript; the script only
 * tracks which image is showing. Scrolling follows the page direction, so RTL needs nothing.
 */
export function Gallery({
  label,
  slides,
  thumbnailLabel,
  emptyLabel,
  loading = false,
  loadingLabel,
  error,
}: GalleryProps) {
  const viewport = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const root = viewport.current
    if (!root || slides.length < 2) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting)
            setActive(Number((entry.target as HTMLElement).dataset['index']))
        }
      },
      { root, threshold: 0.6 },
    )
    for (const child of Array.from(root.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [slides.length])

  const frame = 'relative aspect-4/3 w-full overflow-hidden rounded-card'
  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton shape="block" className="aspect-4/3 w-full rounded-card" />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </div>
    )
  }
  if (error || slides.length === 0) {
    return (
      <div
        className={cx(
          frame,
          'flex flex-col items-center justify-center gap-2 border border-line bg-aluminium p-6 text-center',
        )}
      >
        <Icon
          name={error ? 'alert' : 'image'}
          className={cx('size-8', error ? 'text-critical' : 'text-ink-muted')}
        />
        {error ? (
          <p className="text-base text-critical">{error}</p>
        ) : emptyLabel ? (
          <p className="text-base text-ink-muted">{emptyLabel}</p>
        ) : null}
      </div>
    )
  }

  const show = (index: number) => {
    const target = viewport.current?.children[index]
    if (!(target instanceof HTMLElement)) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'nearest',
      inline: 'start',
    })
    setActive(index)
  }

  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <div
        ref={viewport}
        tabIndex={slides.length > 1 ? 0 : undefined}
        role={slides.length > 1 ? 'group' : undefined}
        aria-label={slides.length > 1 ? label : undefined}
        className={cx(
          'flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-card [scrollbar-width:none]',
          FOCUS_RING,
        )}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            data-index={index}
            className={cx(
              frame,
              'shrink-0 snap-start rounded-none bg-aluminium-deep [&_img]:object-contain',
            )}
          >
            {slide.media}
          </div>
        ))}
      </div>
      {slides.length > 1 ? (
        <ul className="flex flex-wrap gap-2">
          {slides.map((slide, index) => (
            <li key={slide.id}>
              <button
                type="button"
                onClick={() => show(index)}
                aria-label={fill(thumbnailLabel, index + 1, slides.length)}
                aria-current={index === active ? 'true' : undefined}
                className={cx(
                  'relative block size-16 overflow-hidden rounded-control border-2 bg-aluminium-deep [&_img]:object-contain',
                  index === active
                    ? 'border-lacquer'
                    : 'border-transparent hover:border-line-strong',
                  TARGET,
                  FOCUS_RING,
                )}
              >
                {slide.thumb ?? (
                  <span className="absolute inset-0 flex items-center justify-center text-sm text-ink tabular-nums">
                    {index + 1}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
