import type { ReactNode } from 'react'

export interface AppShellProps {
  skipToContentLabel: string
  announcement?: ReactNode
  banner?: ReactNode
  header: ReactNode
  footer: ReactNode
  children: ReactNode
}

/** Page frame: skip link, announcement, header, main landmark, footer. Direction comes from `html[dir]`. */
export function AppShell({
  skipToContentLabel,
  announcement,
  banner,
  header,
  footer,
  children,
}: AppShellProps) {
  return (
    <div className="alpha-shell">
      <a className="alpha-skip-link" href="#main">
        {skipToContentLabel}
      </a>
      {announcement}
      {banner}
      {header}
      <main id="main" className="alpha-main" tabIndex={-1}>
        {children}
      </main>
      {footer}
    </div>
  )
}
