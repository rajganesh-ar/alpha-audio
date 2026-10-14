import type { Payload, TypedUser } from 'payload'
import type { DocType, StockState } from '@alpha/core'

export interface ExplorerQuery {
  sku?: string | undefined
  serial?: string | undefined
}

export interface ExplorerMovement {
  id: number | string
  at: string
  sku: string
  serial: string | null
  qty: number
  from: StockState | null
  to: StockState | null
  location: string
  docType: DocType
  doc: string
  user: string | null
  reason: string | null
}

export interface ExplorerLevel {
  location: string
  state: StockState
  qty: number
}

export interface ExplorerResult {
  query: ExplorerQuery
  /** Oldest first: the order the ledger wrote them. */
  movements: ExplorerMovement[]
  /** Non-zero levels of the SKU, by location then state. */
  levels: ExplorerLevel[]
  serial: { serial: string; sku: string; state: StockState | null; location: string | null } | null
  /** True when there were more movements than shown. */
  truncated: boolean
}

const MAX_SKU_MOVEMENTS = 500

const label = (value: unknown): string =>
  value && typeof value === 'object' && 'code' in value
    ? String((value as { code: unknown }).code)
    : value == null
      ? ''
      : String(value)

/**
 * Reads what the Ledger explorer shows, as the signed-in user with normal access rules: a
 * serial's full history, or a SKU's latest movements and its levels by location and state.
 */
export async function loadLedgerExplorer(
  payload: Payload,
  user: TypedUser | null | undefined,
  query: ExplorerQuery,
): Promise<ExplorerResult> {
  const serialQuery = query.serial?.trim() || undefined
  const skuQuery = query.sku?.trim() || undefined
  const empty: ExplorerResult = {
    query: { sku: skuQuery, serial: serialQuery },
    movements: [],
    levels: [],
    serial: null,
    truncated: false,
  }
  if (!serialQuery && !skuQuery) return empty
  const asUser = { user: user ?? null, overrideAccess: false, depth: 1 } as const

  let serial: ExplorerResult['serial'] = null
  let sku = skuQuery
  if (serialQuery) {
    const { docs } = await payload.find({
      collection: 'serial-numbers',
      where: { serial: { equals: serialQuery } },
      limit: 1,
      ...asUser,
    })
    const record = docs[0]
    if (record) {
      serial = {
        serial: record.serial,
        sku: record.sku,
        state: (record.currentState ?? null) as StockState | null,
        location: label(record.location) || null,
      }
      sku = record.sku
    }
  }

  const where = serialQuery ? { serial: { equals: serialQuery } } : { sku: { equals: sku } }
  // A serial's history is complete; a SKU shows its latest movements.
  const found = await payload.find({
    collection: 'stock-movements',
    where,
    sort: serialQuery ? 'id' : '-id',
    ...(serialQuery ? { pagination: false } : { limit: MAX_SKU_MOVEMENTS }),
    ...asUser,
  })
  const rows = serialQuery ? found.docs : [...found.docs].reverse()

  const movements: ExplorerMovement[] = rows.map((m) => ({
    id: m.id,
    at: m.createdAt,
    sku: m.sku,
    serial: m.serial ?? null,
    qty: Number(m.qty),
    from: (m.fromState ?? null) as StockState | null,
    to: (m.toState ?? null) as StockState | null,
    location: label(m.location),
    docType: m.docType as DocType,
    doc: `${m.docType} ${m.docId}`,
    user:
      m.user && typeof m.user === 'object'
        ? (m.user.email ?? String(m.user.id))
        : m.user
          ? String(m.user)
          : null,
    reason: m.reason ?? null,
  }))

  let levels: ExplorerLevel[] = []
  if (sku) {
    const { docs } = await payload.find({
      collection: 'stock-levels',
      where: { sku: { equals: sku }, qty: { greater_than: 0 } },
      pagination: false,
      ...asUser,
    })
    levels = docs
      .map((l) => ({
        location: label(l.location),
        state: l.state as StockState,
        qty: Number(l.qty),
      }))
      .sort((a, b) => a.location.localeCompare(b.location) || a.state.localeCompare(b.state))
  }

  return {
    query: { sku, serial: serialQuery },
    movements,
    levels,
    serial,
    truncated: !serialQuery && found.totalDocs > MAX_SKU_MOVEMENTS,
  }
}
