import { cx } from '../../lib/cx'
import { FOCUS_RING, MOTION } from '../../lib/styles'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface MarketOption {
  /** Market and language in that language, e.g. "الإمارات العربية المتحدة · العربية". */
  label: string
  href: string
  /** BCP 47 tag of the target page, e.g. `ar-AE`. */
  hrefLang: string
  current: boolean
}

export interface MarketSwitchProps {
  label: string
  currentLabel?: string | undefined
  options: MarketOption[]
  /** `list` shows every option (404 page); `menu` folds them behind a disclosure (header). */
  variant?: 'menu' | 'list' | undefined
  loading?: boolean | undefined
  /** The markets could not be read. */
  error?: string | undefined
  /** Render the menu open (stories, and pages that lead with the choice). */
  defaultOpen?: boolean | undefined
}

/**
 * Market and language picker. Plain links, so it works without JavaScript and every option is
 * a crawlable URL; the disclosure is a native `<details>`. Each option is `dir="auto"` so an
 * Arabic label lays out right to left inside an English page and vice versa.
 */
export function MarketSwitch({
  label,
  currentLabel,
  options,
  variant = 'menu',
  loading = false,
  error,
  defaultOpen = false,
}: MarketSwitchProps) {
  if (loading) {
    return (
      <nav aria-label={label} aria-busy="true" data-testid="market-switch">
        <Skeleton shape="block" className="h-11 w-56 rounded-control" />
      </nav>
    )
  }
  if (error) {
    return (
      <nav aria-label={label} data-testid="market-switch">
        <p className="flex min-h-11 items-center gap-2 text-sm text-critical">
          <Icon name="alert" size={16} />
          {error}
        </p>
      </nav>
    )
  }

  const list = (
    <ul
      className={cx(
        'm-0 list-none p-0',
        variant === 'list' && 'grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2',
      )}
    >
      {options.map((option) => (
        <li key={option.href}>
          <a
            href={option.href}
            hrefLang={option.hrefLang}
            lang={option.hrefLang}
            dir="auto"
            aria-current={option.current ? 'page' : undefined}
            className={cx(
              'flex min-h-11 w-full items-center rounded-control px-3 text-ink underline-offset-4 hover:underline',
              option.current && 'font-semibold underline',
              FOCUS_RING,
            )}
          >
            {option.label}
          </a>
        </li>
      ))}
    </ul>
  )

  if (variant === 'list' || options.length === 0) {
    return (
      <nav aria-label={label} data-testid="market-switch">
        {options.length ? (
          list
        ) : (
          <p className="flex min-h-11 items-center text-sm text-ink-muted">
            {currentLabel ?? label}
          </p>
        )}
      </nav>
    )
  }

  return (
    <nav aria-label={label} data-testid="market-switch">
      <details className="group relative" open={defaultOpen || undefined}>
        <summary
          className={cx(
            'flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control border border-line-strong px-3 text-sm text-ink hover:border-ink [&::-webkit-details-marker]:hidden',
            FOCUS_RING,
            MOTION,
          )}
        >
          <Icon name="globe" size={16} />
          {currentLabel ?? label}
          <Icon name="chevron-down" size={16} className="group-open:rotate-180" />
        </summary>
        <div className="absolute end-0 top-full z-10 mt-1 min-w-64 rounded-card border border-line bg-aluminium p-2">
          {list}
        </div>
      </details>
    </nav>
  )
}
