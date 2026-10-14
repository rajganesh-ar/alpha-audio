/** @alpha/payload — Payload collections, globals, hooks, access, jobs, migrations. */
export * from './access'
export { Markets } from './globals/Markets'
export { LegacyRedirects, LEGACY_REDIRECTS_SLUG } from './collections/LegacyRedirects'
export * from './markets/codes'
export * from './markets/resolve'
export type { MarketRecord, MarketRoute } from './markets/types'
export {
  MARKETS_SLUG,
  getMarketsCached,
  invalidateMarketsCache,
  loadMarkets,
  parseMarketsGlobal,
} from './markets/read'
export { resolveLegacyRedirect, type LegacyRedirect } from './legacy/resolve'
export {
  LEGACY_QUERY_KEYS,
  hasLegacyQuery,
  normalizeLegacyPath,
  normalizeLegacyQuery,
  trackingParams,
} from './legacy/normalize'
export { MARKETS_SEED, seedMarkets, type SeedMarketsResult } from './system/seed-markets'
export { ensureStaffUser, type StaffCredentials } from './system/ensure-staff-user'
