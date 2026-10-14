import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

export interface GridProps {
  children: ReactNode
  /** Render as a list when the items are a collection (product tiles). */
  as?: 'div' | 'ul' | undefined
  className?: string | undefined
}

/**
 * The layout grid from the tokens: 4 columns with a 16 px gutter on mobile, 12 columns with a
 * 24 px gutter from 64rem. Place children with GridItem.
 */
export function Grid({ children, as = 'div', className }: GridProps) {
  const Element = as
  return (
    <Element
      className={cx(
        'grid grid-cols-[repeat(var(--alpha-grid-columns),minmax(0,1fr))] gap-(--alpha-grid-gutter)',
        as === 'ul' && 'list-none p-0',
        className,
      )}
    >
      {children}
    </Element>
  )
}
