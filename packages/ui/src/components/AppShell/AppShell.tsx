import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FOCUS_RING } from '../../lib/styles'

export interface AppShellProps {
  skipToContentLabel: string
  announcement?: ReactNode | undefined
  banner?: ReactNode | undefined
  header: ReactNode
  footer: ReactNode
  children: ReactNode
}

/** Page frame: skip link, announcement, banner, header, main landmark, footer. */
export function AppShell({
  skipToContentLabel,
  announcement,
  banner,
  header,
  footer,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-aluminium text-ink">
      <a
        href="#main"
        className={cx(
          'absolute start-4 -top-12 z-20 rounded-control bg-lacquer px-4 py-2 text-aluminium focus:top-2',
          FOCUS_RING,
        )}
      >
        {skipToContentLabel}
      </a>
      {announcement}
      {banner}
      {header}
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-measure flex-1 px-4 py-8 focus:outline-none"
      >
        {children}
      </main>
      {footer}
    </div>
  )
}
