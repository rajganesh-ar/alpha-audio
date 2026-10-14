import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Badge } from '../Badge/Badge'
import { Icon, type IconName } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface EntryCardProps {
  icon: IconName
  title: string
  body?: string | undefined
  /** Link to the tool. Without it the card shows `unavailableLabel` and is not a link. */
  href?: string | undefined
  ctaLabel?: string | undefined
  unavailableLabel?: string | undefined
  headingLevel?: 2 | 3 | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  error?: string | undefined
}

/** A way into one of the design tools (Advisor, Room Lab, Builder). The whole card is the link. */
export function EntryCard({
  icon,
  title,
  body,
  href,
  ctaLabel,
  unavailableLabel,
  headingLevel = 3,
  loading = false,
  loadingLabel,
  error,
}: EntryCardProps) {
  const Heading = `h${headingLevel}` as const
  const shell =
    'relative flex h-full flex-col gap-3 rounded-card border border-line bg-aluminium p-6'
  if (loading) {
    return (
      <article aria-busy="true" className={shell}>
        <Skeleton shape="circle" className="size-11" />
        <Skeleton lines={1} className="w-1/2" />
        <Skeleton lines={2} />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </article>
    )
  }
  return (
    <article className={cx(shell, href && !error && 'hover:border-line-strong')}>
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-lacquer"
      >
        <Icon name={icon} className="text-vu-amber" />
      </span>
      <Heading className="font-display text-xl font-bold text-ink">
        {href && !error ? (
          <a
            href={href}
            className={cx(
              'after:absolute after:inset-0 after:rounded-card after:content-[""]',
              FOCUS_RING,
            )}
          >
            {title}
          </a>
        ) : (
          title
        )}
      </Heading>
      {body ? <p className="text-base text-ink-muted">{body}</p> : null}
      <div className="mt-auto pt-2">
        {error ? (
          <p className="flex items-center gap-2 text-base text-critical">
            <Icon name="alert" />
            {error}
          </p>
        ) : href ? (
          ctaLabel ? (
            <span className="flex items-center gap-2 font-semibold text-ink">
              {ctaLabel}
              <Icon name="arrow-forward" />
            </span>
          ) : null
        ) : unavailableLabel ? (
          <Badge tone="neutral" label={unavailableLabel} />
        ) : null}
      </div>
    </article>
  )
}
