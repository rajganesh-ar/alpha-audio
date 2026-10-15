/**
 * Search query handling (docs/tasks/0011). Pure: the same normalisation runs in Postgres
 * (`alpha_search_normalise`, migration `product_search`) so queries and the index agree.
 */

export const MAX_QUERY_LENGTH = 100
export const MAX_QUERY_TOKENS = 8
export const SEARCH_PAGE_SIZE = 24

const DIACRITICS = /[ً-ٰٟـ]/g
const FROM = 'أإآٱىة٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'
const TO = 'اااايه01234567890123456789'
const MAP = new Map([...FROM].map((c, i) => [c, TO[i] ?? c]))

/** Lower case; Arabic diacritics and tatweel removed; alef forms, alef maqsura and taa marbuta folded; Arabic-Indic digits to 0–9. */
export function normaliseSearchText(input: string): string {
  return [...input.replace(DIACRITICS, '')]
    .map((c) => MAP.get(c) ?? c)
    .join('')
    .toLowerCase()
}

export interface SearchQuery {
  /** What the shopper typed, tidied for display and the search box. */
  text: string
  /** Normalised words, letters and digits only. */
  tokens: string[]
  /**
   * A `to_tsquery` expression: every word required, the last one as a prefix so results
   * appear while typing ("mcintosh amp" → `mcintosh & amp:*`). Null when nothing is searchable.
   */
  tsquery: string | null
  /** Normalised text for the trigram (typo) fallback. */
  fuzzy: string
}

export function parseSearchQuery(raw: unknown): SearchQuery {
  const text = (typeof raw === 'string' ? raw : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
  const tokens = (normaliseSearchText(text).match(/[\p{L}\p{N}]+/gu) ?? []).slice(
    0,
    MAX_QUERY_TOKENS,
  )
  const tsquery = tokens.length
    ? tokens.map((t, i) => (i === tokens.length - 1 ? `${t}:*` : t)).join(' & ')
    : null
  return { text, tokens, tsquery, fuzzy: tokens.join(' ') }
}

/** Page window over ranked ids: `page` is 1-based and clamped to the last page. */
export function pageOf<T>(items: readonly T[], page: number, size = SEARCH_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(1, Number.isSafeInteger(page) ? page : 1), pages)
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pages,
    total: items.length,
  }
}
