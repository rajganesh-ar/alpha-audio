import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface AnnouncementBarProps {
  children?: ReactNode | undefined
  /** `critical` for service notices (checkout paused, delivery disruption). */
  tone?: 'default' | 'critical' | undefined
  loading?: boolean | undefined
}

/** One line above the header, on lacquer. Content will come from Payload. */
export function AnnouncementBar({
  children,
  tone = 'default',
  loading = false,
}: AnnouncementBarProps) {
  if (!loading && !children) return null
  return (
    <aside
      data-tone={tone === 'critical' ? undefined : 'dark'}
      className={cx('text-sm', tone === 'critical' ? 'bg-alert text-aluminium' : '')}
      data-testid="announcement-bar"
      aria-busy={loading || undefined}
    >
      <div className="mx-auto flex max-w-measure items-center justify-center gap-2 px-4 py-2 text-center">
        {loading ? <Skeleton lines={1} className="w-72" /> : null}
        {!loading && tone === 'critical' ? <Icon name="alert" size={16} /> : null}
        {!loading ? <p>{children}</p> : null}
      </div>
    </aside>
  )
}
