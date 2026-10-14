import { money, vatShareOf, type CurrencyCode, type CurrencyDecimals, type Money } from '../money'

export const PRICE_DISPLAYS = ['show', 'request'] as const
export type PriceDisplay = (typeof PRICE_DISPLAYS)[number]

/** What the price engine needs from the Markets record. */
export interface PricingMarket {
  code: string
  currency: CurrencyCode
  decimals: CurrencyDecimals
  /** Percent, e.g. 5. */
  vatRate: number
}

/** One row of a product's `markets[]`. */
export interface ProductMarketEntry {
  market: string
  published?: boolean | null | undefined
  /** Recommended retail price incl. VAT, in the market currency's minor units. */
  rrpInclVat?: number | null | undefined
  priceDisplay?: PriceDisplay | null | undefined
}

export type ConsumerPrice =
  /** Not sold in this market: the page 404s and no price is shown anywhere. */
  | { kind: 'unavailable' }
  /** Sold, but the price is given on request (brand policy or the product's own setting). */
  | { kind: 'request' }
  | { kind: 'priced'; price: Money; vat: Money; vatRate: number }

/**
 * The consumer (anonymous retail) price of a product in a market. Prices are stored VAT
 * inclusive per market, as the GCC displays them, and the VAT share is derived with the
 * platform's rounding rule. Buyer-specific prices (dealers, contracts) come from the price
 * engine task; nothing here reads a session.
 */
export function consumerPrice(input: {
  market: PricingMarket
  entries: readonly ProductMarketEntry[] | null | undefined
  brandPriceDisplay?: PriceDisplay | null | undefined
}): ConsumerPrice {
  const entry = input.entries?.find((e) => e.market === input.market.code)
  if (!entry?.published) return { kind: 'unavailable' }
  if (input.brandPriceDisplay === 'request' || entry.priceDisplay === 'request')
    return { kind: 'request' }
  const amount = entry.rrpInclVat
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0)
    return { kind: 'request' }
  const price = money(amount, input.market.currency, input.market.decimals)
  return {
    kind: 'priced',
    price,
    vat: vatShareOf(price, input.market.vatRate),
    vatRate: input.market.vatRate,
  }
}

/** Whether a product is published in a market (the storefront's visibility rule). */
export function publishedIn(
  entries: readonly ProductMarketEntry[] | null | undefined,
  market: string,
): boolean {
  return entries?.some((e) => e.market === market && e.published) ?? false
}
