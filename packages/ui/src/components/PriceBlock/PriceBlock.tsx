import type { ReactNode } from 'react'
import { formatMoney, type Money } from '@alpha/core'
import { cx } from '../../lib/cx'
import { Icon } from '../Icon/Icon'
import { Skeleton } from '../Skeleton/Skeleton'

export interface PriceBlockProps {
  /** BCP 47 tag of the page, e.g. `ar-AE`; digits stay Western in every locale. */
  locale: string
  /** Price as resolved by the price engine. `null` means "on request". */
  price?: Money | null | undefined
  /** Already-translated VAT note, e.g. "Incl. VAT 5%". */
  vatLabel?: string | undefined
  /** Previous price, struck through. */
  was?: Money | undefined
  /** Template with `{amount}`, e.g. "Was {amount}". */
  wasTemplate?: string | undefined
  /** Instalment offer from the price engine; the template holds `{amount}`. */
  instalment?: { amount: Money; template: string } | undefined
  /** Shown when there is no price. */
  requestLabel?: string | undefined
  requestAction?: ReactNode | undefined
  loading?: boolean | undefined
  loadingLabel?: string | undefined
  /** The price could not be resolved. */
  error?: string | undefined
  size?: 'md' | 'lg' | undefined
}

function fill(template: string, amount: string): ReactNode {
  const [before, after] = template.split('{amount}')
  return (
    <>
      {before}
      <bdi>{amount}</bdi>
      {after}
    </>
  )
}

/**
 * Displays a price. It formats, it never computes: amounts, VAT and instalments come from
 * `packages/core`, and `formatMoney` writes the market's currency and decimals with Western
 * digits. Amounts sit in `<bdi>` so they read correctly inside Arabic sentences.
 */
export function PriceBlock({
  locale,
  price,
  vatLabel,
  was,
  wasTemplate,
  instalment,
  requestLabel,
  requestAction,
  loading = false,
  loadingLabel,
  error,
  size = 'md',
}: PriceBlockProps) {
  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2" data-state="loading">
        <Skeleton
          shape="block"
          className={cx('rounded-control', size === 'lg' ? 'h-9 w-48' : 'h-7 w-36')}
        />
        <Skeleton lines={1} className="w-28" />
        {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
      </div>
    )
  }
  if (error) {
    return (
      <p className="flex items-center gap-2 text-base text-critical" data-state="error">
        <Icon name="alert" />
        {error}
      </p>
    )
  }
  if (!price) {
    if (!requestLabel) return null
    return (
      <div className="flex flex-col items-start gap-2" data-state="request">
        <p
          className={cx('font-display font-bold text-ink', size === 'lg' ? 'text-2xl' : 'text-xl')}
        >
          {requestLabel}
        </p>
        {requestAction}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1" data-state="priced">
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span
          className={cx(
            'font-display font-bold text-ink tabular-nums',
            size === 'lg' ? 'text-3xl' : 'text-2xl',
          )}
        >
          <bdi>{formatMoney(price, locale)}</bdi>
        </span>
        {was && wasTemplate ? (
          <span className="text-base text-ink-muted line-through tabular-nums">
            {fill(wasTemplate, formatMoney(was, locale))}
          </span>
        ) : null}
      </p>
      {vatLabel ? <p className="text-sm text-ink-muted">{vatLabel}</p> : null}
      {instalment ? (
        <p className="text-sm text-ink tabular-nums">
          {fill(instalment.template, formatMoney(instalment.amount, locale))}
        </p>
      ) : null}
    </div>
  )
}
