import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'
import { Skeleton } from '../Skeleton/Skeleton'

export interface FooterGroup {
  title: string
  links: Array<{ label: string; href: string }>
}

export interface FooterProps {
  copyright: string
  /** Market line, e.g. "Prices in AED, VAT 5% included". */
  pricing?: string | undefined
  groups?: FooterGroup[] | undefined
  /** Usually a MarketSwitch. */
  marketSwitch?: ReactNode | undefined
  loading?: boolean | undefined
}

/** Footer on a lacquer band: link groups, market switch, the market line and the legal line. */
export function Footer({
  copyright,
  pricing,
  groups = [],
  marketSwitch,
  loading = false,
}: FooterProps) {
  return (
    <footer
      data-tone="dark"
      className="mt-16"
      data-testid="site-footer"
      aria-busy={loading || undefined}
    >
      <div className="mx-auto flex max-w-measure flex-col gap-8 px-4 py-12">
        {loading ? (
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} lines={4} />
            ))}
          </div>
        ) : groups.length ? (
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {groups.map((group) => (
              <div key={group.title} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
                  {group.title}
                </h2>
                <ul className="m-0 flex list-none flex-col p-0">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className={cx(
                          'inline-flex min-h-11 items-center text-base text-ink underline-offset-4 hover:underline',
                          FOCUS_RING,
                        )}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
        {marketSwitch}
        <div className="flex flex-col gap-1 border-t border-line pt-6 text-sm text-ink-muted">
          {pricing ? <p>{pricing}</p> : null}
          <p>{copyright}</p>
        </div>
      </div>
    </footer>
  )
}
