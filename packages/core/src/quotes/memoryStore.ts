import type { Id } from '../ledger/types'
import type { NewQuote, QuotePatch, QuoteRecord, QuoteStatus, QuoteStore } from './types'

/** In-memory quote store for unit tests (Postgres: `@alpha/payload` system store). */
export class MemoryQuoteStore implements QuoteStore {
  readonly quotes: QuoteRecord[] = []
  private sequence = 0

  async nextQuoteNumber(market: string, now: Date) {
    return `Q-${market.toUpperCase()}-${now.getUTCFullYear()}-${String(++this.sequence).padStart(6, '0')}`
  }

  async findByIdempotencyKey(key: string) {
    const quote = this.quotes.find((q) => q.idempotencyKey === key)
    return quote ? structuredClone(quote) : null
  }

  async findByNumber(number: string) {
    const quote = this.quotes.find((q) => q.number === number)
    return quote ? structuredClone(quote) : null
  }

  async insertQuote(input: NewQuote) {
    const quote: Partial<NewQuote> = { ...input }
    delete quote.details
    const existing = await this.findByIdempotencyKey(input.idempotencyKey)
    if (existing) return { quote: existing, created: false }
    const record = {
      ...structuredClone(quote as Omit<NewQuote, 'details'>),
      id: this.quotes.length + 1,
    }
    this.quotes.push(record)
    return { quote: structuredClone(record), created: true }
  }

  async transition(id: Id, from: readonly QuoteStatus[], to: QuoteStatus, patch: QuotePatch = {}) {
    const quote = this.quotes.find((q) => q.id === id)
    if (!quote || !from.includes(quote.status)) return false
    Object.assign(quote, structuredClone(patch), { status: to })
    return true
  }

  async update(id: Id, patch: QuotePatch) {
    const quote = this.quotes.find((q) => q.id === id)
    if (quote) Object.assign(quote, structuredClone(patch))
  }
}
