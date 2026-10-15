import { brandsSellableIn } from '@alpha/payload'
import { getRightsWindows } from './catalog'
import { saleRule, type SaleRule } from './saleRule'

export { saleRule, type SaleRule } from './saleRule'

/** The sale rule for this render: use it on every storefront surface (ADR 0008). */
export const getSaleRule = async (): Promise<SaleRule> => saleRule(await getRightsWindows())

/** Brand ids with live rights in a market, for the brand pages. */
export const sellableBrands = async (
  market: string,
  now: Date = new Date(),
): Promise<Set<string>> => brandsSellableIn(await getRightsWindows(), market, now)
