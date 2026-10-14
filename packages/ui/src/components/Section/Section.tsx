import { useId, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

export interface SectionProps {
  title: string
  headingLevel?: 2 | 3 | undefined
  eyebrow?: string | undefined
  description?: string | undefined
  /** Links or buttons at the inline end of the heading row ("View all"). */
  actions?: ReactNode | undefined
  /** `dark`: a lacquer band (hero, cinema, showroom); every role re-colours inside it. */
  tone?: 'light' | 'dark' | undefined
  /** The content is loading: marks the region busy for assistive tech. */
  busy?: boolean | undefined
  children?: ReactNode | undefined
}

/**
 * A titled page band, labelled by its heading. Dark bands have square corners and run edge to
 * edge; content stays within the measure.
 */
export function Section({
  title,
  headingLevel = 2,
  eyebrow,
  description,
  actions,
  tone = 'light',
  busy = false,
  children,
}: SectionProps) {
  const headingId = useId()
  const Heading = `h${headingLevel}` as const
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={busy || undefined}
      data-tone={tone}
      className={cx(tone === 'dark' ? 'py-16' : 'py-12')}
    >
      <div className="mx-auto flex max-w-measure flex-col gap-6 px-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            {eyebrow ? (
              <p className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
                {eyebrow}
              </p>
            ) : null}
            <Heading
              id={headingId}
              className="font-display text-3xl font-bold text-ink font-stretch-expanded"
            >
              {title}
            </Heading>
            {description ? (
              <p className="max-w-prose text-lg text-ink-muted">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {children}
      </div>
    </section>
  )
}
