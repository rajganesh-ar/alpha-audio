export { Companies } from './Companies'
export { CompanyUsers, COMPANY_ROLES, type CompanyRole } from './CompanyUsers'
export { BuyerGroups, ContractPrices, PriceLists, PriceRules } from './pricing'
export { TradeOrders } from './TradeOrders'
export { Quotes } from './Quotes'
export { ProjectRegistrations } from './ProjectRegistrations'
export { Leads } from './Leads'

import { Companies } from './Companies'
import { CompanyUsers } from './CompanyUsers'
import { BuyerGroups, ContractPrices, PriceLists, PriceRules } from './pricing'
import { TradeOrders } from './TradeOrders'
import { Quotes } from './Quotes'
import { ProjectRegistrations } from './ProjectRegistrations'
import { Leads } from './Leads'

/** Every trade collection, in admin order. */
export const tradeCollections = [
  Companies,
  CompanyUsers,
  TradeOrders,
  Quotes,
  ProjectRegistrations,
  Leads,
  ContractPrices,
  PriceLists,
  BuyerGroups,
  PriceRules,
]
