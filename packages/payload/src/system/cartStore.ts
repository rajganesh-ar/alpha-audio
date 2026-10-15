import { createHash, randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import type { BagItem } from '@alpha/core'
import type { LocaleCode, MarketCode } from '../markets/codes'

/**
 * Bags (docs/tasks/0009). The browser keeps a random token; the database keeps its SHA-256, so
 * a database read never yields a usable cart cookie. System code (`overrideAccess: true`): carts
 * belong to anonymous shoppers and no user may read or write them through the API.
 */

export const CART_TTL_DAYS = 7

export interface CartLine extends BagItem {
  /** Unit price incl. VAT when added, minor units (to announce a price change). */
  priceSnapshot: number | null
}

export interface Cart {
  id: number
  market: string
  locale: string
  lines: CartLine[]
  draft: Record<string, unknown>
  status: 'open' | 'converted'
  orderId: number | null
}

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')
export const newToken = (): string => randomBytes(32).toString('base64url')

interface CartDoc {
  id: number
  market: string
  locale: string
  lines?: Array<{ sku: string; qty: number; priceSnapshot?: number | null }> | null
  draft?: unknown
  status: 'open' | 'converted'
  order?: number | { id: number } | null
}

const toCart = (doc: CartDoc): Cart => ({
  id: doc.id,
  market: doc.market,
  locale: doc.locale,
  lines: (doc.lines ?? []).map((l) => ({
    sku: l.sku,
    qty: Number(l.qty),
    priceSnapshot: l.priceSnapshot ?? null,
  })),
  draft: doc.draft && typeof doc.draft === 'object' ? (doc.draft as Record<string, unknown>) : {},
  status: doc.status,
  orderId: typeof doc.order === 'object' ? (doc.order?.id ?? null) : (doc.order ?? null),
})

/** The open, unexpired cart for a token in a market. */
export async function loadCart(
  payload: Payload,
  token: string | undefined,
  market: string,
  now = new Date(),
): Promise<Cart | null> {
  if (!token) return null
  const { docs } = await payload.find({
    collection: 'carts',
    where: {
      and: [
        { tokenHash: { equals: hashToken(token) } },
        { market: { equals: market } },
        { status: { equals: 'open' } },
        { expiresAt: { greater_than: now.toISOString() } },
      ],
    },
    limit: 1,
    depth: 0,
    // System read: see the module comment.
    overrideAccess: true,
  })
  const doc = docs[0] as unknown as CartDoc | undefined
  return doc ? toCart(doc) : null
}

/** Creates or updates a cart; returns it with its token (a new one when created). */
export async function saveCart(
  payload: Payload,
  input: {
    cart: Cart | null
    token: string | undefined
    market: MarketCode
    locale: LocaleCode
    lines?: readonly CartLine[]
    draft?: Record<string, unknown>
  },
  now = new Date(),
): Promise<{ cart: Cart; token: string }> {
  const expiresAt = new Date(now.getTime() + CART_TTL_DAYS * 86_400_000).toISOString()
  const data = {
    ...(input.lines
      ? {
          lines: input.lines.map((l) => ({
            sku: l.sku,
            qty: l.qty,
            priceSnapshot: l.priceSnapshot,
          })),
        }
      : {}),
    ...(input.draft ? { draft: input.draft } : {}),
    locale: input.locale,
    expiresAt,
  }
  if (input.cart && input.token) {
    const doc = await payload.update({
      collection: 'carts',
      id: input.cart.id,
      data,
      depth: 0,
      // System write: see the module comment.
      overrideAccess: true,
    })
    return { cart: toCart(doc as unknown as CartDoc), token: input.token }
  }
  const token = newToken()
  const doc = await payload.create({
    collection: 'carts',
    data: {
      ...data,
      tokenHash: hashToken(token),
      market: input.market,
      status: 'open',
      lines: data.lines ?? [],
      draft: data.draft ?? {},
    },
    depth: 0,
    // System write: see the module comment.
    overrideAccess: true,
  })
  return { cart: toCart(doc as unknown as CartDoc), token }
}

/** Marks a cart converted once its order is confirmed; a new bag starts empty. */
export async function convertCart(
  payload: Payload,
  cartId: number,
  orderId: number,
): Promise<void> {
  await payload.update({
    collection: 'carts',
    id: cartId,
    data: { status: 'converted', order: orderId },
    depth: 0,
    // System write: see the module comment.
    overrideAccess: true,
  })
}

/** Points the cart at the order its checkout started, so the confirmation can close it. */
export async function linkCartOrder(
  payload: Payload,
  cartId: number,
  orderId: number,
): Promise<void> {
  await payload.update({
    collection: 'carts',
    id: cartId,
    data: { order: orderId },
    depth: 0,
    // System write: see the module comment.
    overrideAccess: true,
  })
}

/** Closes the open cart behind a confirmed order (idempotent: a converted cart is left alone). */
export async function convertCartForOrder(payload: Payload, orderId: number): Promise<void> {
  await payload.update({
    collection: 'carts',
    where: { and: [{ order: { equals: orderId } }, { status: { equals: 'open' } }] },
    data: { status: 'converted' },
    depth: 0,
    // System write: see the module comment.
    overrideAccess: true,
  })
}
