import type { Payload, Where } from 'payload'
import { sql, type SQL } from '@payloadcms/db-postgres/drizzle'
import {
  DEFAULT_QUOTE_VALIDITY_DAYS,
  QuoteService,
  money,
  type CreateQuoteResult,
  type CurrencyCode,
  type CurrencyDecimals,
  type Id,
  type NewQuote,
  type QuoteLine,
  type QuoteOrderResult,
  type QuotePatch,
  type QuoteRecord,
  type QuoteStatus,
  type QuoteStore,
  type QuoteWithdrawResult,
  type TraceStep,
} from '@alpha/core'
import { companyOf } from '../access'
import type { LocaleCode } from '../markets/codes'
import { createLedger, drizzleOf } from './ledgerStore'
import { companyContext } from './pricing'
import { createTradeOrders, orderParties, priceDraft, type OrderDraftLine } from './tradeOrders'

/**
 * Dealer quotes (docs/tasks/0016, ADR 0016). System code: every quote field is system-written,
 * so quotes are written here with `overrideAccess: true`; only the company's own outcome reaches
 * the dealer. The company is always the signed-in user's; status changes are compare-and-set in
 * SQL.
 */

const system = {
  depth: 0,
  // System code: quote fields are system-written (see the module comment).
  overrideAccess: true,
} as const

interface QuoteDoc {
  id: number
  number: string
  company: number | { id: number }
  createdBy: number | { id: number }
  market: string
  status: QuoteStatus
  idempotencyKey: string
  currency: string
  decimals: number
  lines?: Array<{
    product?: number | { id: number } | null
    sku: string
    title: string
    qty: number
    unitNet?: number | null
    lineNet?: number | null
    vat?: number | null
    basis?: string | null
    priceStatus?: string | null
    held?: boolean | null
    trace?: unknown
  }> | null
  totals: { net: number; vat: number; gross: number }
  reservations?: unknown
  validUntil: string
  fxLockedAt?: string | null
  fxRates?: unknown
  orderNumber?: string | null
}

const idOf = (v: number | { id: number } | null | undefined): number | null =>
  v === null || v === undefined ? null : typeof v === 'object' ? v.id : v

export function toQuoteRecord(doc: QuoteDoc): QuoteRecord {
  const m = (amount: number) =>
    money(Number(amount), doc.currency as CurrencyCode, Number(doc.decimals) as CurrencyDecimals)
  const opt = (amount: number | null | undefined) =>
    amount === null || amount === undefined ? null : m(amount)
  const lines = (doc.lines ?? []).map((l): QuoteLine => ({
    sku: l.sku,
    productId: idOf(l.product),
    title: l.title,
    qty: Number(l.qty),
    status: (l.priceStatus as QuoteLine['status'] | null) ?? 'ok',
    unit: opt(l.unitNet),
    total: opt(l.lineNet),
    vat: opt(l.vat),
    basis: (l.basis as QuoteLine['basis']) ?? null,
    trace: Array.isArray(l.trace) ? (l.trace as TraceStep[]) : [],
    held: Boolean(l.held),
  }))
  const reservations = Array.isArray(doc.reservations)
    ? (doc.reservations as unknown[]).map((r) =>
        typeof r === 'number' || typeof r === 'string' ? r : null,
      )
    : lines.map(() => null)
  return {
    id: doc.id,
    number: doc.number,
    company: idOf(doc.company) ?? 0,
    createdBy: idOf(doc.createdBy) ?? 0,
    market: doc.market,
    status: doc.status,
    idempotencyKey: doc.idempotencyKey,
    lines,
    totals: { net: m(doc.totals.net), vat: m(doc.totals.vat), gross: m(doc.totals.gross) },
    reservations,
    validUntil: new Date(doc.validUntil),
    fxLock: {
      at: doc.fxLockedAt ? new Date(doc.fxLockedAt) : new Date(doc.validUntil),
      rates:
        doc.fxRates && typeof doc.fxRates === 'object'
          ? (doc.fxRates as Record<string, string>)
          : {},
    },
    order: doc.orderNumber ?? null,
  }
}

const n = (m: { amount: bigint } | null) => (m ? Number(m.amount) : null)
const linesData = (lines: readonly QuoteLine[]) =>
  lines.map((l) => ({
    product: typeof l.productId === 'number' ? l.productId : Number(l.productId) || null,
    sku: l.sku,
    title: l.title,
    qty: l.qty,
    unitNet: n(l.unit),
    lineNet: n(l.total),
    vat: n(l.vat),
    basis: l.basis,
    priceStatus: l.status,
    held: l.held,
    trace: l.trace,
  }))

export class PostgresQuoteStore implements QuoteStore {
  constructor(private readonly payload: Payload) {}

  private get db() {
    return drizzleOf(this.payload)
  }

  private async findOne(where: Where): Promise<QuoteRecord | null> {
    const { docs } = await this.payload.find({ collection: 'quotes', where, limit: 1, ...system })
    const doc = docs[0] as unknown as QuoteDoc | undefined
    return doc ? toQuoteRecord(doc) : null
  }

  async nextQuoteNumber(market: string, now: Date): Promise<string> {
    const { rows } = await this.db.execute(sql`SELECT nextval('quote_number_seq') AS n`)
    return `Q-${market.toUpperCase()}-${now.getUTCFullYear()}-${String(rows[0]?.['n']).padStart(6, '0')}`
  }

  findByIdempotencyKey(key: string) {
    return this.findOne({ idempotencyKey: { equals: key } })
  }

  findByNumber(number: string) {
    return this.findOne({ number: { equals: number } })
  }

  async insertQuote(quote: NewQuote) {
    const d = quote.details as {
      reference?: string | null
      note?: string | null
      vatRate?: number
      project?: string | null
    }
    try {
      const doc = await this.payload.create({
        collection: 'quotes',
        data: {
          number: quote.number,
          status: quote.status,
          company: Number(quote.company),
          createdBy: Number(quote.createdBy),
          market: quote.market as never, // reason: a market code, checked by the select field
          currency: quote.totals.gross.currency,
          decimals: quote.totals.gross.decimals,
          vatRate: d.vatRate ?? 0,
          reference: d.reference ?? null,
          note: d.note ?? null,
          project: d.project ?? null,
          lines: linesData(quote.lines),
          totals: {
            net: Number(quote.totals.net.amount),
            vat: Number(quote.totals.vat.amount),
            gross: Number(quote.totals.gross.amount),
          },
          validUntil: quote.validUntil.toISOString(),
          fxLockedAt: quote.fxLock.at.toISOString(),
          fxRates: quote.fxLock.rates,
          reservations: quote.reservations,
          orderNumber: quote.order,
          idempotencyKey: quote.idempotencyKey,
        },
        ...system,
      })
      return { quote: toQuoteRecord(doc as unknown as QuoteDoc), created: true }
    } catch (error) {
      // A concurrent request with the same key won the unique index: that is the quote.
      const existing = await this.findByIdempotencyKey(quote.idempotencyKey)
      if (existing) return { quote: existing, created: false }
      throw error
    }
  }

  private async applyLines(id: Id, patch: QuotePatch) {
    if (patch.lines === undefined) return
    // Lines live in their own table; Payload rewrites them (held flags) for this system update.
    await this.payload.update({
      collection: 'quotes',
      id: Number(id),
      data: { lines: linesData(patch.lines) },
      ...system,
    })
  }

  private sets(patch: QuotePatch): SQL[] {
    const sets: SQL[] = [sql`updated_at = now()`]
    if (patch.reservations !== undefined)
      sets.push(sql`reservations = ${JSON.stringify(patch.reservations)}::jsonb`)
    if (patch.order !== undefined) sets.push(sql`order_number = ${patch.order}`)
    return sets
  }

  async transition(id: Id, from: readonly QuoteStatus[], to: QuoteStatus, patch: QuotePatch = {}) {
    const { rows } = await this.db.execute(sql`
      UPDATE quotes SET status = ${to}, ${sql.join(this.sets(patch), sql`, `)}
      WHERE id = ${Number(id)} AND status::text IN (${sql.join(
        from.map((s) => sql`${s}`),
        sql`, `,
      )})
      RETURNING id`)
    const won = rows.length === 1
    if (won) await this.applyLines(id, patch)
    return won
  }

  async update(id: Id, patch: QuotePatch) {
    await this.db.execute(
      sql`UPDATE quotes SET ${sql.join(this.sets(patch), sql`, `)} WHERE id = ${Number(id)}`,
    )
    await this.applyLines(id, patch)
  }
}

export function createQuotes(payload: Payload, now?: () => Date): QuoteService {
  return new QuoteService(
    new PostgresQuoteStore(payload),
    createLedger(payload, now),
    createTradeOrders(payload, now),
    now,
  )
}

// ── For the signed-in company user ───────────────────────────────────────────────────────────

export interface QuoteInput {
  lines: readonly OrderDraftLine[]
  idempotencyKey: string
  reference?: string | null | undefined
  note?: string | null | undefined
  /** An approved project registration of the company (docs/tasks/0017). */
  project?: string | null | undefined
  locale: LocaleCode
}

/** Quotes the draft lines for the signed-in company user; null for anyone else. */
export async function createQuoteFromDraft(
  payload: Payload,
  user: unknown,
  input: QuoteInput,
  now?: () => Date,
): Promise<CreateQuoteResult | { ok: false; reason: 'project-unavailable' } | null> {
  const at = now?.() ?? new Date()
  const draft = await priceDraft(payload, user, input.lines, input.locale, at, input.project)
  if (!draft) return null
  if (draft.projectUnavailable) return { ok: false, reason: 'project-unavailable' }
  const settings = (await payload.findGlobal({ slug: 'pricing-settings', ...system })) as {
    quoteValidityDays?: number | null
  }
  return createQuotes(payload, now).create({
    company: { id: draft.company.id, market: draft.company.market },
    creator: { id: draft.placer.id, role: draft.placer.role },
    idempotencyKey: input.idempotencyKey,
    lines: draft.tradeLines,
    totals: draft.totals,
    validityDays: settings.quoteValidityDays ?? DEFAULT_QUOTE_VALIDITY_DAYS,
    fxRates: draft.fxRates,
    details: {
      reference: input.reference?.trim().slice(0, 120) || null,
      note: input.note?.trim().slice(0, 1000) || null,
      vatRate: draft.session.context.vatRate,
      project: draft.project?.number ?? null,
    },
  })
}

async function ownQuote(payload: Payload, user: unknown, number: string) {
  const company = companyOf(user)
  if (company === null) return null
  const quote = await new PostgresQuoteStore(payload).findByNumber(number)
  return quote && String(quote.company) === String(company) ? quote : null
}

/**
 * Orders the signed-in company user's own quote at its locked prices. Another company's quote
 * is `not-found`; the order's roles, hold, rules, credit and approvals are the order service's.
 */
export async function orderQuote(
  payload: Payload,
  user: unknown,
  number: string,
  now?: () => Date,
): Promise<QuoteOrderResult> {
  const quote = await ownQuote(payload, user, number)
  const session = quote ? await companyContext(payload, user) : null
  if (!quote || !session) return { ok: false, reason: 'not-found' }
  const raw = (await payload.findByID({
    collection: 'quotes',
    id: Number(quote.id),
    ...system,
  })) as {
    reference?: string | null
    note?: string | null
    project?: string | null
  }
  const parties = await orderParties(payload, session, user)
  return createQuotes(payload, now).toOrder(number, {
    ...parties,
    details: {
      poNumber: raw.reference ?? null,
      note: raw.note ?? null,
      project: raw.project ?? null,
      vatRate: session.context.vatRate,
    },
  })
}

/** Withdraws the signed-in company user's own open quote (owners and purchasers). */
export async function withdrawQuote(
  payload: Payload,
  user: unknown,
  number: string,
  now?: () => Date,
): Promise<QuoteWithdrawResult | { ok: false; reason: 'forbidden' }> {
  const quote = await ownQuote(payload, user, number)
  if (!quote) return { ok: false, reason: 'not-found' }
  const role = String((user as { role?: unknown }).role ?? '')
  if (role !== 'owner' && role !== 'purchaser') return { ok: false, reason: 'forbidden' }
  return createQuotes(payload, now).withdraw(number)
}
