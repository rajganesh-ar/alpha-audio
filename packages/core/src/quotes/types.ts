import type { Id } from '../ledger/types'
import type { TradeLine, TradeTotals } from '../tradeOrders/types'

/** Dealer quote states (docs/tasks/0016). `ordering` is the short claim while it becomes an order. */
export const QUOTE_STATUSES = ['open', 'ordering', 'ordered', 'withdrawn', 'expired'] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const DEFAULT_QUOTE_VALIDITY_DAYS = 7
export const MAX_QUOTE_VALIDITY_DAYS = 30

/** A locked line: the engine's outcome at quoting time, and whether stock is held for it. */
export interface QuoteLine extends TradeLine {
  held: boolean
}

/** The FX rates the prices were worked out with (AED per unit, decimal strings) and when. */
export interface FxLock {
  at: Date
  rates: Readonly<Record<string, string>>
}

export interface QuoteRecord {
  id: Id
  number: string
  company: Id
  createdBy: Id
  market: string
  status: QuoteStatus
  /** Scoped to the company: `<company>:<client key>`. */
  idempotencyKey: string
  lines: QuoteLine[]
  totals: TradeTotals
  /** Ledger holds by line index; null where the line is not held. */
  reservations: Array<Id | null>
  validUntil: Date
  fxLock: FxLock
  /** The dealer order it became. */
  order: string | null
}

export type NewQuote = Omit<QuoteRecord, 'id'> & {
  /** Reference, note, currency, VAT rate: stored as the app shapes them. */
  details: Readonly<Record<string, unknown>>
}

export type QuotePatch = Partial<Pick<QuoteRecord, 'lines' | 'reservations' | 'order'>>

/** Persistence for dealer quotes. The Postgres store lives in `@alpha/payload` (system). */
export interface QuoteStore {
  /** `Q-AE-2026-000123`, from a database sequence. */
  nextQuoteNumber(market: string, now: Date): Promise<string>
  findByIdempotencyKey(key: string): Promise<QuoteRecord | null>
  findByNumber(number: string): Promise<QuoteRecord | null>
  /** Inserts, or returns the quote that already holds the idempotency key. */
  insertQuote(quote: NewQuote): Promise<{ quote: QuoteRecord; created: boolean }>
  /** Compare-and-set: moves the quote to `to` only from one of `from`; true when this call won. */
  transition(
    id: Id,
    from: readonly QuoteStatus[],
    to: QuoteStatus,
    patch?: QuotePatch,
  ): Promise<boolean>
  update(id: Id, patch: QuotePatch): Promise<void>
}
