import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres/drizzle'
import type { SearchQuery } from '@alpha/core'
import type { LocaleCode } from '../markets/codes'
import { drizzleOf } from './ledgerStore'

/** Below this trigram word similarity a fuzzy match is noise. */
export const FUZZY_THRESHOLD = 0.5
export const MAX_SEARCH_CANDIDATES = 200

/**
 * Ranked product ids for a query (docs/tasks/0011, ADR 0011): stemmed full-text matches first
 * (weights: title and brand/SKU, then categories, then summary), then unstemmed prefix matches
 * (a word typed half-way), then typo matches by trigram similarity.
 * Published products only; the caller applies the market's sale rule and loads the documents
 * through the Local API with the visitor's access. Read-only system code: it reads the search
 * index table, which no Payload collection exposes.
 */
export async function searchProductIds(
  payload: Payload,
  query: SearchQuery,
  locale: LocaleCode,
  limit = MAX_SEARCH_CANDIDATES,
): Promise<number[]> {
  if (!query.tsquery) return []
  const cfg = locale === 'ar' ? 'arabic' : 'english'
  const { rows } = await drizzleOf(payload).execute(sql`
    WITH q AS (
      SELECT to_tsquery(${cfg}::regconfig, ${query.tsquery}) AS stemmed,
             to_tsquery('simple', ${query.tsquery}) AS plain
    )
    SELECT s.product_id AS id,
      CASE WHEN s.document @@ q.stemmed THEN 2 + ts_rank_cd(s.document, q.stemmed, 1)
           WHEN s.document @@ q.plain THEN 1 + ts_rank_cd(s.document, q.plain, 1)
           ELSE 0 END
        + word_similarity(${query.fuzzy}, s.terms) AS score
    FROM product_search s
    CROSS JOIN q
    JOIN products p ON p.id = s.product_id
    WHERE s.locale = ${locale}
      AND p._status = 'published'
      AND (s.document @@ q.stemmed OR s.document @@ q.plain
           OR word_similarity(${query.fuzzy}, s.terms) >= ${FUZZY_THRESHOLD})
    ORDER BY score DESC, s.product_id
    LIMIT ${limit}`)
  return rows.map((r) => Number(r['id']))
}
