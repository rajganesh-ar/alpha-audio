import type { ReactNode } from 'react'

export interface AnnouncementBarProps {
  children: ReactNode
}

/** One-line notice above the header. Content will come from Payload; this is the stub. */
export function AnnouncementBar({ children }: AnnouncementBarProps) {
  return (
    <aside className="alpha-announcement" data-testid="announcement-bar">
      <p className="alpha-announcement__text">{children}</p>
    </aside>
  )
}
