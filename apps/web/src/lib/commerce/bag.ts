import type { Payload } from 'payload'
import {
  priceBag,
  type LineProblem,
  type Money,
  type PricedBag,
  type PricedLine,
} from '@alpha/core'
import { loadCart, type Cart, type CartLine, type MarketRoute } from '@alpha/payload'
import type { Product } from '@/payload-types'
import { lookupCatalog, type CatalogHit } from './catalog'

export interface BagLineView {
  sku: string
  qty: number
  product: Product | null
  /** Priced now; null when the line cannot be bought. */
  line: PricedLine | null
  problem: LineProblem | null
  /** The unit price when the line was last changed, if the price has moved since. */
  priceChangedFrom: Money | null
}

export interface BagView {
  cart: Cart | null
  lines: BagLineView[]
  bag: PricedBag
  catalog: Map<string, CatalogHit>
}

/** The shopper's bag in a market, priced from the catalogue now (never from the snapshot). */
export async function viewBag(
  payload: Payload,
  route: MarketRoute,
  token: string | undefined,
  now: Date = new Date(),
): Promise<BagView> {
  const cart = await loadCart(payload, token, route.market.code, now)
  return priceCart(payload, route, cart, now)
}

export async function priceCart(
  payload: Payload,
  route: MarketRoute,
  cart: Cart | null,
  now: Date = new Date(),
): Promise<BagView> {
  const items = cart?.lines ?? []
  const catalog = await lookupCatalog(
    payload,
    items.map((i) => i.sku),
    route,
    now,
  )
  const bag = priceBag(items, (sku) => catalog.get(sku)?.entry, route.market)
  const lines = items.map((item): BagLineView => {
    const line = bag.lines.find((l) => l.sku === item.sku) ?? null
    const snapshot = item.priceSnapshot
    return {
      sku: item.sku,
      qty: item.qty,
      product: catalog.get(item.sku)?.product ?? null,
      line,
      problem: bag.problems.find((p) => p.sku === item.sku)?.problem ?? null,
      priceChangedFrom:
        line && snapshot !== null && BigInt(snapshot) !== line.unitPrice.amount
          ? { ...line.unitPrice, amount: BigInt(snapshot) }
          : null,
    }
  })
  return { cart, lines, bag, catalog }
}

/** Snapshots today's unit prices on the lines (the baseline for the price-changed notice). */
export function snapshotLines(
  items: readonly { sku: string; qty: number }[],
  catalog: ReadonlyMap<string, CatalogHit>,
): CartLine[] {
  return items.map((item) => {
    const price = catalog.get(item.sku)?.entry.price
    return {
      sku: item.sku,
      qty: item.qty,
      priceSnapshot: price?.kind === 'priced' ? Number(price.price.amount) : null,
    }
  })
}
