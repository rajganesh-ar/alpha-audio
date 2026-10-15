import type { Payload, Where } from 'payload'
import { sql, type SQL } from '@payloadcms/db-postgres/drizzle'
import {
  CREDIT_STATUSES,
  ORDERING_ROLES,
  TradeOrderService,
  creditPosition,
  money,
  resolvePrices,
  type Approval,
  type CreditPosition,
  type CurrencyCode,
  type CurrencyDecimals,
  type DecisionResult,
  type Id,
  type NewTradeOrder,
  type PriceLine,
  type RuleCheck,
  type SubmitInput,
  type SubmitResult,
  type TraceStep,
  type TradeLine,
  type TradeOrderPatch,
  type TradeOrderRecord,
  type TradeOrderStatus,
  type TradeOrderStore,
  type TradeTotals,
} from '@alpha/core'
import { companyOf, isCompanyUser } from '../access'
import type { LocaleCode } from '../markets/codes'
import { createLedger, drizzleOf } from './ledgerStore'
import { partnerLine } from './partnerCatalogue'
import { companyContext, loadPricingData, type CompanyContext } from './pricing'

/**
 * Dealer orders (docs/tasks/0015, ADR 0015). System code: every order field is system-written,
 * so orders are written here with `overrideAccess: true`, and the company's terms (credit, hold,
 * order rules) are read here for the check; only the outcome reaches the dealer. The company is
 * always the signed-in user's; status changes are compare-and-set in SQL.
 */

const system = {
  depth: 0,
  // System code: trade order fields and company terms are system-only (see the module comment).
  overrideAccess: true,
} as const

interface TradeOrderDoc {
  id: number
  number: string
  company: number | { id: number }
  placedBy: number | { id: number }
  market: string
  status: TradeOrderStatus
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
    trace?: unknown
  }> | null
  totals: { net: number; vat: number; gross: number }
  approvals?: unknown
  reservations?: unknown
  unavailableSkus?: unknown
  holdExpiresAt?: string | null
  failureReason?: 'stock-lost' | null
  closedReason?: string | null
}

const idOf = (v: number | { id: number } | null | undefined): number | null =>
  v === null || v === undefined ? null : typeof v === 'object' ? v.id : v
const ids = (value: unknown): Id[] =>
  Array.isArray(value)
    ? value.filter((v): v is Id => typeof v === 'number' || typeof v === 'string')
    : []
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

function approvalsOf(value: unknown): Approval[] {
  if (!Array.isArray(value)) return []
  return value.map((a: Record<string, unknown>) => ({
    kind: a['kind'] as Approval['kind'],
    reason: a['reason'] as Approval['reason'],
    status: a['status'] as Approval['status'],
    by: (a['by'] as Id | null) ?? null,
    at: typeof a['at'] === 'string' ? new Date(a['at']) : null,
    note: typeof a['note'] === 'string' ? a['note'] : null,
  }))
}

export function toTradeOrderRecord(doc: TradeOrderDoc): TradeOrderRecord {
  const m = (amount: number) =>
    money(Number(amount), doc.currency as CurrencyCode, Number(doc.decimals) as CurrencyDecimals)
  const opt = (amount: number | null | undefined) =>
    amount === null || amount === undefined ? null : m(amount)
  return {
    id: doc.id,
    number: doc.number,
    company: idOf(doc.company) ?? 0,
    placedBy: idOf(doc.placedBy) ?? 0,
    market: doc.market,
    status: doc.status,
    idempotencyKey: doc.idempotencyKey,
    lines: (doc.lines ?? []).map((l): TradeLine => ({
      sku: l.sku,
      productId: idOf(l.product),
      title: l.title,
      qty: Number(l.qty),
      status: (l.priceStatus as TradeLine['status'] | null) ?? 'ok',
      unit: opt(l.unitNet),
      total: opt(l.lineNet),
      vat: opt(l.vat),
      basis: (l.basis as TradeLine['basis']) ?? null,
      trace: Array.isArray(l.trace) ? (l.trace as TraceStep[]) : [],
    })),
    totals: { net: m(doc.totals.net), vat: m(doc.totals.vat), gross: m(doc.totals.gross) },
    approvals: approvalsOf(doc.approvals),
    reservations: ids(doc.reservations),
    holdExpiresAt: doc.holdExpiresAt ? new Date(doc.holdExpiresAt) : null,
    failureReason: doc.failureReason ?? null,
    unavailableSkus: strings(doc.unavailableSkus),
    closedReason: doc.closedReason ?? null,
  }
}

function patchSql(patch: TradeOrderPatch): SQL[] {
  const sets: SQL[] = [sql`updated_at = now()`]
  const json = (v: unknown) => sql`${JSON.stringify(v)}::jsonb`
  if (patch.approvals !== undefined) sets.push(sql`approvals = ${json(patch.approvals)}`)
  if (patch.reservations !== undefined) sets.push(sql`reservations = ${json(patch.reservations)}`)
  if (patch.unavailableSkus !== undefined)
    sets.push(sql`unavailable_skus = ${json(patch.unavailableSkus)}`)
  if (patch.holdExpiresAt !== undefined)
    sets.push(
      sql`hold_expires_at = ${patch.holdExpiresAt ? patch.holdExpiresAt.toISOString() : null}`,
    )
  if (patch.failureReason !== undefined) sets.push(sql`failure_reason = ${patch.failureReason}`)
  if (patch.closedReason !== undefined) sets.push(sql`closed_reason = ${patch.closedReason}`)
  return sets
}

/** The part of node-postgres' Pool the lock uses (the adapter's pool). */
interface PgPool {
  connect(): Promise<{
    query<R>(text: string, values: unknown[]): Promise<{ rows: R[] }>
    release(): void
  }>
}

const LOCK_WAIT_MS = 15_000
/** Keeps company advisory locks apart from any other advisory lock in the database. */
const LOCK_NAMESPACE = 15

export class PostgresTradeOrderStore implements TradeOrderStore {
  constructor(private readonly payload: Payload) {}

  private get db() {
    return drizzleOf(this.payload)
  }

  private async findOne(where: Where): Promise<TradeOrderRecord | null> {
    const { docs } = await this.payload.find({
      collection: 'trade-orders',
      where,
      limit: 1,
      ...system,
    })
    const doc = docs[0] as unknown as TradeOrderDoc | undefined
    return doc ? toTradeOrderRecord(doc) : null
  }

  async nextOrderNumber(market: string, now: Date): Promise<string> {
    const { rows } = await this.db.execute(sql`SELECT nextval('trade_order_number_seq') AS n`)
    return `T-${market.toUpperCase()}-${now.getUTCFullYear()}-${String(rows[0]?.['n']).padStart(6, '0')}`
  }

  findByIdempotencyKey(key: string) {
    return this.findOne({ idempotencyKey: { equals: key } })
  }

  findByNumber(number: string) {
    return this.findOne({ number: { equals: number } })
  }

  async insertOrder(order: NewTradeOrder) {
    const d = order.details as { poNumber?: string | null; note?: string | null; vatRate?: number }
    const n = (m: { amount: bigint } | null) => (m ? Number(m.amount) : null)
    try {
      const doc = await this.payload.create({
        collection: 'trade-orders',
        data: {
          number: order.number,
          status: order.status,
          company: Number(order.company),
          placedBy: Number(order.placedBy),
          market: order.market as never, // reason: a market code, checked by the select field
          currency: order.totals.gross.currency,
          decimals: order.totals.gross.decimals,
          vatRate: d.vatRate ?? 0,
          poNumber: d.poNumber ?? null,
          note: d.note ?? null,
          lines: order.lines.map((l) => ({
            product: typeof l.productId === 'number' ? l.productId : Number(l.productId) || null,
            sku: l.sku,
            title: l.title,
            qty: l.qty,
            unitNet: n(l.unit),
            lineNet: n(l.total),
            vat: n(l.vat),
            basis: l.basis,
            priceStatus: l.status,
            trace: l.trace,
          })),
          totals: {
            net: Number(order.totals.net.amount),
            vat: Number(order.totals.vat.amount),
            gross: Number(order.totals.gross.amount),
          },
          approvals: order.approvals.map((a) => ({ ...a, at: a.at?.toISOString() ?? null })),
          reservations: order.reservations,
          unavailableSkus: order.unavailableSkus,
          holdExpiresAt: order.holdExpiresAt?.toISOString() ?? null,
          idempotencyKey: order.idempotencyKey,
        },
        ...system,
      })
      return { order: toTradeOrderRecord(doc as unknown as TradeOrderDoc), created: true }
    } catch (error) {
      // A concurrent submit with the same key won the unique index: that is the order.
      const existing = await this.findByIdempotencyKey(order.idempotencyKey)
      if (existing) return { order: existing, created: false }
      throw error
    }
  }

  async transition(
    id: Id,
    from: readonly TradeOrderStatus[],
    to: TradeOrderStatus,
    patch: TradeOrderPatch = {},
  ) {
    const approvals =
      patch.approvals === undefined
        ? patch
        : {
            ...patch,
            approvals: patch.approvals.map((a) => ({ ...a, at: a.at?.toISOString() ?? null })),
          }
    const { rows } = await this.db.execute(sql`
      UPDATE trade_orders SET status = ${to}, ${sql.join(patchSql(approvals as TradeOrderPatch), sql`, `)}
      WHERE id = ${Number(id)} AND status::text IN (${sql.join(
        from.map((s) => sql`${s}`),
        sql`, `,
      )})
      RETURNING id`)
    return rows.length === 1
  }

  async creditUsed(company: Id): Promise<bigint> {
    const { rows } = await this.db.execute(sql`
      SELECT COALESCE(SUM(totals_gross), 0)::bigint AS used FROM trade_orders
      WHERE company_id = ${Number(company)} AND status::text IN (${sql.join(
        CREDIT_STATUSES.map((s) => sql`${s}`),
        sql`, `,
      )})`)
    return BigInt(String(rows[0]?.['used'] ?? 0))
  }

  /**
   * A session advisory lock per company, taken with `pg_try_advisory_lock` on one dedicated
   * connection. Waiters poll without holding a connection, so many parallel orders cannot
   * exhaust the pool while the holder's own queries need it.
   */
  async withCompanyLock<T>(company: Id, fn: () => Promise<T>): Promise<T> {
    // reason: the Postgres adapter keeps its pg Pool on `pool`; the base adapter type omits it
    const pool = (this.payload.db as unknown as { pool: PgPool }).pool
    const deadline = Date.now() + LOCK_WAIT_MS
    for (let wait = 5; ; wait = Math.min(wait * 2, 100)) {
      const client = await pool.connect()
      let locked = false
      try {
        const { rows } = await client.query<{ ok: boolean }>(
          'SELECT pg_try_advisory_lock($1, $2) AS ok',
          [LOCK_NAMESPACE, Number(company)],
        )
        locked = rows[0]?.ok === true
        if (locked) return await fn()
      } finally {
        if (locked)
          await client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_NAMESPACE, Number(company)])
        client.release()
      }
      if (Date.now() > deadline) throw new Error(`Timed out waiting for company ${String(company)}`)
      await new Promise((resolve) => setTimeout(resolve, wait + Math.random() * wait))
    }
  }
}

export function createTradeOrders(payload: Payload, now?: () => Date): TradeOrderService {
  return new TradeOrderService(
    new PostgresTradeOrderStore(payload),
    createLedger(payload, now),
    now,
  )
}

// ── For the signed-in company user ───────────────────────────────────────────────────────────

interface CompanyTerms {
  hold?: boolean | null
  creditLimit?: number | null
  settings?: { minOrderValue?: number | null; orderMultiple?: number | null } | null
}
interface PlacerDoc {
  id: number
  role?: string | null
  approvalThreshold?: number | null
}

export interface OrderDraftLine {
  sku: string
  qty: number
}

export interface TradeOrderDraft {
  session: CompanyContext
  lines: TradeLine[]
  totals: TradeTotals
  problems: RuleCheck
  approvals: Approval[]
  /** Owners and purchasers only (as the company's terms access); null for viewers. */
  credit: CreditPosition | null
  hold: boolean
  canOrder: boolean
  /** Owners and purchasers quote even on hold (spec: a hold blocks checkout, not quoting). */
  canQuote: boolean
  /** How long a quote of these lines would keep its prices (PricingSettings). */
  quoteValidityDays: number
}

const big = (v: number | null | undefined) =>
  typeof v === 'number' && Number.isFinite(v) ? BigInt(Math.trunc(v)) : null

/** Merges repeated SKUs and drops blank rows, keeping the order the dealer typed. */
export function mergeDraftLines(lines: readonly OrderDraftLine[]): OrderDraftLine[] {
  const merged = new Map<string, number>()
  for (const l of lines) {
    const sku = l.sku.trim().toUpperCase()
    if (!sku) continue
    merged.set(sku, (merged.get(sku) ?? 0) + l.qty)
  }
  return [...merged].map(([sku, qty]) => ({ sku, qty }))
}

/** The company's ordering terms and the placer's role and threshold (system reads). */
export async function orderParties(
  payload: Payload,
  session: CompanyContext,
  user: unknown,
): Promise<Pick<SubmitInput, 'company' | 'placer'>> {
  const [terms, placer] = await Promise.all([
    payload.findByID({ collection: 'companies', id: session.company.id, ...system }),
    payload.findByID({
      collection: 'company-users',
      id: Number((user as { id: unknown }).id),
      ...system,
    }),
  ])
  const t = terms as unknown as CompanyTerms
  const p = placer as unknown as PlacerDoc
  return {
    company: {
      id: session.company.id,
      market: session.company.market,
      hold: Boolean(t.hold),
      creditLimit: big(t.creditLimit),
      rules: {
        orderMultiple: t.settings?.orderMultiple ?? null,
        minOrderValue: big(t.settings?.minOrderValue),
      },
    },
    placer: { id: p.id, role: p.role ?? 'viewer', approvalThreshold: big(p.approvalThreshold) },
  }
}

const AED_MICROS = 1_000_000n
const fxDecimal = (micros: bigint) =>
  `${micros / AED_MICROS}.${String(micros % AED_MICROS).padStart(6, '0')}`

/**
 * The draft lines priced for the signed-in company user now, with the company's terms, the
 * placer, and the FX rates the engine used (quotes lock them). Null for anyone who is not a
 * company user.
 */
export async function priceDraft(
  payload: Payload,
  user: unknown,
  raw: readonly OrderDraftLine[],
  locale: LocaleCode,
  at: Date,
) {
  const session = await companyContext(payload, user, at)
  if (!session) return null
  const lines = mergeDraftLines(raw)
  const [parties, products] = await Promise.all([
    orderParties(payload, session, user),
    lines.length
      ? payload.find({
          collection: 'products',
          where: { sku: { in: lines.map((l) => l.sku) } },
          locale,
          limit: lines.length,
          depth: 0,
          draft: false,
          user: user as never, // reason: the caller's authenticated user, typed by Payload per app
          overrideAccess: false,
          select: { sku: true, title: true },
        })
      : Promise.resolve({ docs: [] }),
  ])
  const data = await loadPricingData(
    payload,
    session.context,
    lines.map((l) => l.sku),
  )
  const valid = lines.filter((l) => Number.isSafeInteger(l.qty) && l.qty >= 1)
  const priced = resolvePrices(session.context, valid as PriceLine[], data)
  const byPrice = new Map(priced.lines.map((l) => [l.sku, partnerLine(l)]))
  const titles = new Map(
    (products.docs as unknown as Array<{ id: number; sku: string; title?: string | null }>).map(
      (p) => [p.sku, p],
    ),
  )
  const tradeLines = lines.map((l): TradeLine => {
    const r = byPrice.get(l.sku)
    const product = titles.get(l.sku)
    return {
      sku: l.sku,
      productId: product?.id ?? null,
      title: product?.title ?? l.sku,
      qty: l.qty,
      status: r?.status ?? 'unavailable',
      unit: r?.unit ?? null,
      total: r?.total ?? null,
      vat: r?.vat ?? null,
      basis: r?.basis ?? null,
      trace: r?.trace ?? [],
    }
  })
  return {
    session,
    tradeLines,
    totals: priced.totals,
    ...parties,
    fxRates: Object.fromEntries(
      Object.entries(data.settings.fxAedMicros).map(([c, m]) => [c, fxDecimal(m)]),
    ),
  }
}

/** The review: priced lines, rule problems, approvals and credit, without placing anything. */
export async function previewTradeOrder(
  payload: Payload,
  user: unknown,
  lines: readonly OrderDraftLine[],
  options: { locale: LocaleCode; at?: Date },
): Promise<TradeOrderDraft | null> {
  const draft = await priceDraft(payload, user, lines, options.locale, options.at ?? new Date())
  if (!draft) return null
  const service = createTradeOrders(payload)
  const settings = (await payload.findGlobal({ slug: 'pricing-settings', ...system })) as {
    quoteValidityDays?: number | null
  }
  const preview = await service.preview({
    company: draft.company,
    placer: draft.placer,
    lines: draft.tradeLines,
    totals: draft.totals,
  })
  return {
    session: draft.session,
    lines: draft.tradeLines,
    totals: draft.totals,
    problems: preview.problems,
    approvals: preview.approvals,
    credit: ORDERING_ROLES.includes(draft.placer.role)
      ? creditPosition(draft.company.creditLimit, preview.creditUsed, draft.totals.gross)
      : null,
    hold: draft.company.hold,
    canOrder: ORDERING_ROLES.includes(draft.placer.role) && !draft.company.hold,
    canQuote: ORDERING_ROLES.includes(draft.placer.role),
    quoteValidityDays: settings.quoteValidityDays ?? 7,
  }
}

export interface PlaceInput {
  lines: readonly OrderDraftLine[]
  idempotencyKey: string
  poNumber?: string | null | undefined
  note?: string | null | undefined
  locale: LocaleCode
}

/** Places the signed-in company user's order; null when the user is not a company user. */
export async function placeTradeOrder(
  payload: Payload,
  user: unknown,
  input: PlaceInput,
  now?: () => Date,
): Promise<SubmitResult | null> {
  const draft = await priceDraft(payload, user, input.lines, input.locale, now?.() ?? new Date())
  if (!draft) return null
  return createTradeOrders(payload, now).submit({
    company: draft.company,
    placer: draft.placer,
    idempotencyKey: input.idempotencyKey,
    lines: draft.tradeLines,
    totals: draft.totals,
    details: {
      poNumber: input.poNumber?.trim().slice(0, 64) || null,
      note: input.note?.trim().slice(0, 1000) || null,
      vatRate: draft.session.context.vatRate,
    },
  })
}

export type TradeDecision = 'approve' | 'reject' | 'cancel'

/**
 * A decision on an order by whoever is signed in: an owner decides their company's approvals
 * and may cancel; the placer may cancel their own pending order; staff decide Alpha's
 * approvals. Anyone else, or an order of another company, is `not-found`.
 */
export async function decideTradeOrder(
  payload: Payload,
  user: unknown,
  number: string,
  decision: TradeDecision,
  note: string | null = null,
  now?: () => Date,
): Promise<DecisionResult | { ok: false; reason: 'forbidden' }> {
  const service = createTradeOrders(payload, now)
  const order = await new PostgresTradeOrderStore(payload).findByNumber(number)
  const staff = (user as { collection?: string } | null)?.collection === 'users'
  const company = companyOf(user)
  if (!order || (!staff && (company === null || String(order.company) !== String(company))))
    return { ok: false, reason: 'not-found' }
  const trimmed = note?.trim().slice(0, 500) || null
  const by = (user as { id: Id }).id
  if (staff) {
    if (decision === 'cancel') return { ok: false, reason: 'forbidden' }
    return service.decide(number, { kind: 'alpha', by }, decision, trimmed)
  }
  const role = String((user as { role?: unknown }).role ?? '')
  if (decision === 'cancel') {
    if (role !== 'owner' && String(order.placedBy) !== String(by))
      return { ok: false, reason: 'forbidden' }
    return service.cancel(number, trimmed)
  }
  if (role !== 'owner') return { ok: false, reason: 'forbidden' }
  return service.decide(number, { kind: 'company', by }, decision, trimmed)
}

/**
 * The company's credit now: limit, used and available. Owners and purchasers only, like the
 * company's terms; null for anyone else.
 */
export async function tradeCredit(payload: Payload, user: unknown): Promise<CreditPosition | null> {
  if (!isCompanyUser(user as { collection?: string } | null)) return null
  const placer = (await payload.findByID({
    collection: 'company-users',
    id: Number((user as { id: unknown }).id),
    ...system,
    disableErrors: true,
  })) as unknown as PlacerDoc | null
  if (!placer || !ORDERING_ROLES.includes(placer.role ?? '')) return null
  const session = await companyContext(payload, user)
  if (!session) return null
  const terms = (await payload.findByID({
    collection: 'companies',
    id: session.company.id,
    ...system,
  })) as unknown as CompanyTerms
  const used = await new PostgresTradeOrderStore(payload).creditUsed(session.company.id)
  return creditPosition(
    big(terms.creditLimit),
    used,
    money(0n, session.context.currency, session.context.decimals),
  )
}
