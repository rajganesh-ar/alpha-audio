import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

export type MobileSpan = 1 | 2 | 3 | 4
export type DesktopSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

// Class names are listed in full so Tailwind can find them.
const MOBILE: Record<MobileSpan, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
}
const DESKTOP: Record<DesktopSpan, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
}

export interface GridItemProps {
  children: ReactNode
  /** Columns of 4 on mobile. */
  span?: MobileSpan | undefined
  /** Columns of 12 from 64rem. */
  spanDesktop?: DesktopSpan | undefined
  as?: 'div' | 'li' | undefined
}

export function GridItem({ children, span = 4, spanDesktop = 12, as = 'div' }: GridItemProps) {
  const Element = as
  return <Element className={cx(MOBILE[span], DESKTOP[spanDesktop])}>{children}</Element>
}
