# ADR 0011 — Keyword search in Postgres; sitemaps from the sale rule

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0011-search-legal-seo.md`

## Context

The spec's search is hybrid: keyword plus vectors, with an intent parse. The vector half needs embeddings from the LLM layer (P3). The storefront needs search now, in English and Arabic, and it must never show a product the market cannot sell. Crawlers need per-market sitemaps that agree with the same rule, and the legal pages must exist before the store takes orders.

## Decision

1. **The keyword half is Postgres full-text search**, with no new service and no second query layer.
   - Data: `product_search` holds one row per product and locale.
   - Ranking weights: title plus brand and SKU (A), category titles (B), summary (C), and every word unstemmed (D).
   - Stemmers: English and Arabic. The Arabic document also holds the English title, so model names typed in Latin script match on Arabic pages.
   - Typos: a `terms` string with trigram similarity (`pg_trgm`, threshold 0.5).
2. **The index is maintained by database triggers** (migration `product_search`) on products, their locales and category relations, brand names, and category titles.
   - Any write path keeps it current: the admin, seeds, the Local API, or SQL.
   - Only published documents are searched (`_status = 'published'`).
3. **Normalisation is defined twice and tested for equality**: `alpha_search_normalise` in SQL and `normaliseSearchText` in `packages/core/search`.
   - It lower-cases; removes Arabic diacritics and tatweel; folds alef forms, alef maqsura and taa marbuta; and turns Arabic-Indic digits into 0–9.
   - Queries become a `tsquery` built only from letters and digits (every word required, the last as a prefix), so user input can never inject query syntax.
4. **Results go through the sale rule** (ADR 0008) after ranking, and products are loaded through the Local API as an anonymous visitor.
   - The index never decides visibility; it only ranks candidates (at most 200), which are then paged 24 at a time.
5. **Sitemaps come from the same rules as the pages.**
   - `/{m}/sitemap.xml` lists home, shop, categories (two levels), brands with live rights, products on sale and legal pages published in the market. Each URL is listed in every locale of the market, with the hreflang set of every market where it exists.
   - `/sitemap.xml` indexes the live markets.
   - `robots.txt` disallows bag, checkout, orders, account, search, `/ops`, `/admin` and `/api`.
6. **Legal pages are a `Pages` collection** (kind `legal`): localized rich text, published per market (`markets[]`), a last-reviewed date, and the `content` cache tag.
   - The seeded copy says on the page that it is a draft for legal review.

## Consequences

- Adding vectors later means a second candidate list from pgvector merged into the same ranking (reciprocal rank fusion) behind `searchProductIds`. The page, the sale rule and the paging stay as they are.
- Category and brand titles changed in a draft do not reach the index until published; the triggers fire on the published tables.
- Search terms are not logged yet. The `search` telemetry event, popular queries and zero-result analysis come with the observability task.
