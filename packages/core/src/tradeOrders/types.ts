import type { Id } from '../ledger/types'
import type { Money } from '../money'
import type { PriceStatus, ResolvedLine, TraceStep } from '../pricing/types'

/**
 * Dealer order states (docs/tasks/0015, ADR 0015). `reserving` and `approving` are short-lived
 * claims: whoever moves an order into them owns the next step.
 */
export const TRADE_ORDER_STATUSES = [
  'reserving',
  'unavailable',
  'pending-approval',
  'approving',
  'confirmed',
  'rejected',
  'cancelled',
  'failed',
] as const
export type TradeOrderStatus = (typeof TRADE_ORDER_STATUSES)[number]

/** States that use the company's credit (spec: used = open orders + unpaid invoices). */
export const CREDIT_STATUSES = [
  'reserving',
  'pending-approval',
  'approving',
  'confirmed',
] as const satisfies readonly TradeOrderStatus[]

export const APPROVAL_KINDS = ['company', 'alpha'] as const
export type ApprovalKind = (typeof APPROVAL_KINDS)[number]
/** `threshold`: above the purchaser's limit; `credit`: over the credit limit; `price`: below the margin floor. */
export const APPROVAL_REASONS = ['threshold', 'credit', 'price'] as const
export type ApprovalReason = (typeof APPROVAL_REASONS)[number]
export const APPROVAL_STATES = ['pending', 'approved', 'rejected'] as const
export type ApprovalState = (typeof APPROVAL_STATES)[number]

export interface Approval {
  kind: ApprovalKind
  reason: ApprovalReason
  status: ApprovalState
  by: Id | null
  at: Date | null
  note: string | null
}

/** Pending orders hold their stock this long; the last approval makes the hold permanent. */
export const PENDING_HOLD_MS = 72 * 60 * 60 * 1000
export const MAX_TRADE_LINES = 200
export const MAX_TRADE_QTY = 10_000

/** A priced line ready to order: the engine's outcome plus what the order shows. */
export interface TradeLine {
  sku: string
  productId: Id | null
  title: string
  qty: number
  status: PriceStatus
  unit: Money | null
  total: Money | null
  vat: Money | null
  basis: ResolvedLine['basis']
  trace: TraceStep[]
}

export interface TradeTotals {
  net: Money
  vat: Money
  gross: Money
}

export interface TradeOrderRecord {
  id: Id
  number: string
  company: Id
  placedBy: Id
  market: string
  status: TradeOrderStatus
  /** Scoped to the company: `<company>:<client key>`. */
  idempotencyKey: string
  lines: TradeLine[]
  totals: TradeTotals
  approvals: Approval[]
  reservations: Id[]
  holdExpiresAt: Date | null
  failureReason: 'stock-lost' | null
  unavailableSkus: string[]
  /** Why it was rejected or cancelled, in the decider's words. */
  closedReason: string | null
}

export type NewTradeOrder = Omit<TradeOrderRecord, 'id'> & {
  /** PO reference, note, currency, VAT rate: stored as the app shapes them. */
  details: Readonly<Record<string, unknown>>
}

export type TradeOrderPatch = Partial<
  Pick<
    TradeOrderRecord,
    | 'approvals'
    | 'reservations'
    | 'holdExpiresAt'
    | 'failureReason'
    | 'unavailableSkus'
    | 'closedReason'
  >
>

/** Persistence for dealer orders. The Postgres store lives in `@alpha/payload` (system). */
export interface TradeOrderStore {
  /** `T-AE-2026-000123`, from a database sequence. */
  nextOrderNumber(market: string, now: Date): Promise<string>
  findByIdempotencyKey(key: string): Promise<TradeOrderRecord | null>
  findByNumber(number: string): Promise<TradeOrderRecord | null>
  /** Inserts, or returns the order that already holds the idempotency key. */
  insertOrder(order: NewTradeOrder): Promise<{ order: TradeOrderRecord; created: boolean }>
  /** Compare-and-set: moves the order to `to` only from one of `from`; true when this call won. */
  transition(
    id: Id,
    from: readonly TradeOrderStatus[],
    to: TradeOrderStatus,
    patch?: TradeOrderPatch,
  ): Promise<boolean>
  /** Gross of the company's orders in `CREDIT_STATUSES`, minor units. */
  creditUsed(company: Id): Promise<bigint>
  /** Runs `fn` while no other call for the same company runs (credit check and insert). */
  withCompanyLock<T>(company: Id, fn: () => Promise<T>): Promise<T>
}
