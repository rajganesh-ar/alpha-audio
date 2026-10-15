import { LedgerError } from '../ledger/errors'
import type { LedgerService } from '../ledger/LedgerService'
import type { Id } from '../ledger/types'
import { ORDERING_ROLES, checkOrderRules, rulesPass, type RuleCheck } from '../tradeOrders/rules'
import type { SubmitInput, SubmitResult, TradeOrderService } from '../tradeOrders/TradeOrderService'
import type { TradeLine, TradeOrderRecord, TradeTotals } from '../tradeOrders/types'
import {
  DEFAULT_QUOTE_VALIDITY_DAYS,
  MAX_QUOTE_VALIDITY_DAYS,
  type QuoteLine,
  type QuoteRecord,
  type QuoteStore,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/** A quote line as the order service takes it (without the quote's held flag). */
function tradeLine(line: QuoteLine): TradeLine {
  const copy: Partial<QuoteLine> = { ...line }
  delete copy.held
  return copy as TradeLine
}

export interface CreateQuoteInput {
  company: { id: Id; market: string }
  creator: { id: Id; role: string }
  idempotencyKey: string
  /** Priced by the engine for this company now; never from the client. */
  lines: TradeLine[]
  totals: TradeTotals
  validityDays?: number | undefined
  /** AED per unit of each currency, as the engine used them. */
  fxRates: Readonly<Record<string, string>>
  details: Readonly<Record<string, unknown>>
}

export type CreateQuoteResult =
  | { ok: true; quote: QuoteRecord; created: boolean }
  | { ok: false; reason: 'not-allowed' }
  | { ok: false; reason: 'lines'; problems: RuleCheck }

export type QuoteOrderResult =
  | { ok: true; quote: QuoteRecord; order: TradeOrderRecord }
  | { ok: false; reason: 'not-found' | 'not-open' | 'expired' | 'busy' }
  | { ok: false; reason: 'order-refused'; refusal: Exclude<SubmitResult, { ok: true }> }

export type QuoteWithdrawResult =
  { ok: true; quote: QuoteRecord } | { ok: false; reason: 'not-found' | 'not-open' | 'busy' }

/**
 * Dealer quotes (docs/tasks/0016, ADR 0016). A quote locks the company's prices, trace and FX
 * for its validity and holds what stock it can for the same time; it becomes at most one dealer
 * order, placed through `TradeOrderService` at the locked prices with the quote's holds moved
 * across. Every status change is a compare-and-set.
 */
export class QuoteService {
  constructor(
    private readonly store: QuoteStore,
    private readonly ledger: LedgerService,
    private readonly orders: TradeOrderService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(input: CreateQuoteInput): Promise<CreateQuoteResult> {
    const key = `${String(input.company.id)}:${input.idempotencyKey}`
    const existing = await this.store.findByIdempotencyKey(key)
    if (existing) return { ok: true, quote: existing, created: false }
    if (!ORDERING_ROLES.includes(input.creator.role)) return { ok: false, reason: 'not-allowed' }
    // Order rules (multiples, minimum value) apply when the quote is ordered, not now.
    const problems = checkOrderRules(input.lines, input.totals.net, {
      orderMultiple: null,
      minOrderValue: null,
    })
    if (!rulesPass(problems)) return { ok: false, reason: 'lines', problems }

    const now = this.now()
    const days = Math.min(
      Math.max(Math.trunc(input.validityDays ?? DEFAULT_QUOTE_VALIDITY_DAYS), 1),
      MAX_QUOTE_VALIDITY_DAYS,
    )
    const validUntil = new Date(now.getTime() + days * DAY_MS)
    const placed = await this.store.insertQuote({
      number: await this.store.nextQuoteNumber(input.company.market, now),
      company: input.company.id,
      createdBy: input.creator.id,
      market: input.company.market,
      status: 'open',
      idempotencyKey: key,
      lines: input.lines.map((l) => ({ ...l, held: false })),
      totals: input.totals,
      reservations: input.lines.map(() => null),
      validUntil,
      fxLock: { at: now, rates: input.fxRates },
      order: null,
      details: input.details,
    })
    if (!placed.created) return { ok: true, quote: placed.quote, created: false }

    const quote = placed.quote
    const reservations: Array<Id | null> = []
    for (const line of quote.lines) {
      const r = await this.ledger.reserve({
        sku: line.sku,
        qty: line.qty,
        market: quote.market,
        doc: { type: 'quote', id: quote.number },
        expiresAt: validUntil,
      })
      reservations.push(r.ok ? r.reservation.id : null)
    }
    const lines: QuoteLine[] = quote.lines.map((l, i) => ({ ...l, held: reservations[i] !== null }))
    await this.store.update(quote.id, { reservations, lines })
    return { ok: true, created: true, quote: { ...quote, reservations, lines } }
  }

  /**
   * Turns an open quote into a dealer order at its locked prices. The order service applies the
   * company's rules, credit, approvals and roles as for any order; if it refuses, the quote stays
   * open. The order's idempotency key is the quote's, so a retry finds the same order.
   */
  async toOrder(
    number: string,
    order: Pick<SubmitInput, 'company' | 'placer' | 'details'>,
  ): Promise<QuoteOrderResult> {
    const quote = await this.store.findByNumber(number)
    if (!quote) return { ok: false, reason: 'not-found' }
    if (quote.status === 'ordering') return { ok: false, reason: 'busy' }
    if (quote.status !== 'open') return { ok: false, reason: 'not-open' }
    if (quote.validUntil.getTime() <= this.now().getTime()) {
      if (await this.store.transition(quote.id, ['open'], 'expired'))
        await this.releaseAll(quote.reservations)
      return { ok: false, reason: 'expired' }
    }
    if (!(await this.store.transition(quote.id, ['open'], 'ordering')))
      return { ok: false, reason: 'busy' }

    const result = await this.orders.submit({
      ...order,
      idempotencyKey: `quote-${quote.number}`,
      lines: quote.lines.map(tradeLine),
      totals: quote.totals,
      holds: quote.reservations,
    })
    if (!result.ok) {
      // Stock refusals release whatever the order had taken over, the quote's holds included.
      const patch =
        result.reason === 'unavailable'
          ? {
              reservations: quote.reservations.map(() => null),
              lines: quote.lines.map((l) => ({ ...l, held: false })),
            }
          : {}
      await this.store.transition(quote.id, ['ordering'], 'open', patch)
      return { ok: false, reason: 'order-refused', refusal: result }
    }
    await this.store.transition(quote.id, ['ordering'], 'ordered', {
      order: result.order.number,
      reservations: quote.reservations.map(() => null),
    })
    return {
      ok: true,
      order: result.order,
      quote: { ...quote, status: 'ordered', order: result.order.number },
    }
  }

  /** The dealer withdraws an open quote; its stock is released. */
  async withdraw(number: string): Promise<QuoteWithdrawResult> {
    const quote = await this.store.findByNumber(number)
    if (!quote) return { ok: false, reason: 'not-found' }
    if (quote.status === 'ordering') return { ok: false, reason: 'busy' }
    if (!(await this.store.transition(quote.id, ['open'], 'withdrawn')))
      return { ok: false, reason: 'not-open' }
    await this.releaseAll(quote.reservations)
    return { ok: true, quote: { ...quote, status: 'withdrawn' } }
  }

  /** Releases holds that are still active; ones that lapsed or moved are skipped. */
  private async releaseAll(ids: ReadonlyArray<Id | null>): Promise<void> {
    for (const id of ids) {
      if (id === null) continue
      try {
        await this.ledger.release(id, { reason: 'quote' })
      } catch (error) {
        if (!(error instanceof LedgerError)) throw error
      }
    }
  }
}
