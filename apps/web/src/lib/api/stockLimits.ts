import type { StockPromiseStatus } from '@alpha/core'

/** Public consumer stock for SKUs in a market: status and ETA, never unit counts. */
export interface StockResponse {
  market: string
  stock: Record<string, { status: StockPromiseStatus; eta: string | null }>
}

export const MAX_SKUS = 24
