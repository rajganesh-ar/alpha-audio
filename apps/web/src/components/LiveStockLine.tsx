'use client'

import { useEffect, useState } from 'react'
import { StockLine, type StockStatus } from '@alpha/ui'
import { fetchStock, type LiveStock } from '@/lib/stockClient'

export interface LiveStockLabels {
  'in-stock': string
  low: string
  'on-order': string
  out: string
  /** With `{date}`. */
  eta: string
  onOrderNoDate: string
}

export interface LiveStockLineProps {
  market: string
  sku: string
  /** The promise at render time (ISR); replaced by the live one once it arrives. */
  initial: LiveStock
  labels: LiveStockLabels
  /** BCP 47 tag with Latin digits, e.g. `ar-AE-u-nu-latn`. */
  dateLocale: string
  timeZone: string
}

const STATUS: Record<LiveStock['status'], StockStatus> = {
  'in-stock': 'in-stock',
  low: 'low',
  'on-order': 'on-order',
  out: 'out',
}

/**
 * The product's stock line, live. The page is static (ISR) and renders the promise it had at
 * build or revalidation; this island asks the ledger again on load and when the tab regains
 * focus, so a sale or a goods receipt shows without a rebuild. Updates are announced politely.
 */
export function LiveStockLine({
  market,
  sku,
  initial,
  labels,
  dateLocale,
  timeZone,
}: LiveStockLineProps) {
  const [stock, setStock] = useState<LiveStock>(initial)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      void fetchStock(market, sku).then((live) => {
        if (!cancelled && live) setStock(live)
      })
    }
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [market, sku])

  const detail =
    stock.status === 'on-order'
      ? stock.eta
        ? labels.eta.replace(
            '{date}',
            new Intl.DateTimeFormat(dateLocale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              timeZone,
            }).format(new Date(stock.eta)),
          )
        : labels.onOrderNoDate
      : undefined

  return (
    <div aria-live="polite" data-sku={sku} data-stock={stock.status}>
      <StockLine status={STATUS[stock.status]} label={labels[stock.status]} detail={detail} />
    </div>
  )
}
