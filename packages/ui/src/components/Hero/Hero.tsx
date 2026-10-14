import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Button } from '../Button/Button'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface HeroProps {
  headline?: string | undefined
  eyebrow?: string | undefined
  lede?: string | undefined
  cta?: { label: string; href: string } | undefined
  /** Poster image (a `next/image` with `fill` and `priority` in the app). Paints first. */
  media?: ReactNode | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  /** The hero content could not be loaded; shown in the band instead of the copy. */
  error?: string | undefined
}

/**
 * Page-opening lacquer band (radius 0): the poster fills it, the copy sits at the start edge
 * over a lacquer fade so text keeps its contrast on any image. The headline is the page's h1.
 */
export function Hero({
  headline,
  eyebrow,
  lede,
  cta,
  media,
  loading = false,
  loadingLabel,
  error,
}: HeroProps) {
  const band = 'relative isolate flex min-h-112 items-end overflow-hidden'
  if (loading) {
    return (
      <section data-tone="dark" aria-busy="true" className={band}>
        <div className="flex w-full max-w-measure flex-col gap-4 px-4 py-12 md:px-8">
          <Skeleton lines={1} className="w-24" />
          <Skeleton shape="block" className="h-12 w-3/4 max-w-xl rounded-control" />
          <Skeleton lines={2} className="max-w-lg" />
        </div>
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </section>
    )
  }
  return (
    <section
      data-tone="dark"
      className={band}
      data-state={error ? 'error' : media ? 'media' : 'plain'}
    >
      {media && !error ? (
        <>
          <div className="absolute inset-0 -z-20 [&_img]:object-cover">{media}</div>
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-t from-lacquer via-lacquer/70 to-lacquer/10"
          />
        </>
      ) : null}
      <div
        className={cx(
          'flex w-full max-w-measure flex-col items-start gap-4 px-4 py-12 md:px-8 md:py-16',
        )}
      >
        {error ? (
          <p className="flex items-center gap-2 text-lg text-critical">
            <Icon name="alert" />
            {error}
          </p>
        ) : (
          <>
            {eyebrow ? (
              <p className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
                {eyebrow}
              </p>
            ) : null}
            {headline ? (
              <h1 className="max-w-3xl font-display text-3xl font-bold text-ink font-stretch-expanded md:text-4xl">
                {headline}
              </h1>
            ) : null}
            {lede ? <p className="max-w-2xl text-lg text-ink-muted">{lede}</p> : null}
            {cta ? (
              <div className="mt-2">
                <Button href={cta.href}>{cta.label}</Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
