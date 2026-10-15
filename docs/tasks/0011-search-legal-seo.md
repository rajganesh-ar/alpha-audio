# Task 0011 — Search, legal pages, sitemaps and robots

Phase: P2 Storefront. Depends on: 0006–0008 (catalogue, sale rule). Spec: Sitemap, URL scheme and redirects (search, legal, `sitemap.xml`, `robots.txt`); Page specifications (Search, global chrome: header search, footer legal); Performance, SEO and accessibility standards.

## Goal

A shopper can search the catalogue of their market in English or Arabic and read the legal pages (terms, privacy, returns, warranty) that a GCC storefront must show before it takes orders. Crawlers get a sitemap per market and a robots file that keeps private pages out. The header links only to pages that exist. The spec's hybrid search (keyword plus vectors, with an intent parse) needs embeddings from the LLM layer (P3), so this task builds the keyword half on Postgres full-text search, which the vector half will join later without changing the page.

## Deliverables

- **`Pages` collection** (migration included):
  - Localized title, summary, rich text body (Lexical), SEO group and `kind` (`legal`; more kinds later).
  - Per-market publishing (`markets[]`, so a market can carry its own returns policy), last reviewed date, drafts.
  - Access: published or staff.
  - Publishing expires the `content` cache tag.
  - Seeded with draft-quality terms, privacy, returns and warranty copy in `en` and `ar`. The copy is marked for legal review, never presented as final.
- **Legal pages** at `/{m}/{l}/legal/{slug}/`:
  - ISR on the `content` tag, with breadcrumb, last reviewed date and a table of contents from the headings.
  - 404 when the page is not published in the market.
  - Footer links to the four pages.
- **Search** in `packages/core/search`:
  - Query parsing: trim, cap the length, normalise Arabic (alef forms, taa marbuta, diacritics, tatweel) and digits.
  - Ranking helpers.
  - Unit tested.
- **Search store** (`packages/payload/system/search`):
  - A Postgres `tsvector` per product and locale (title, brand, SKU, summary, category titles) maintained by migration-defined triggers, with a GIN index.
  - Prefix matching for the last word, plus a trigram fallback for typos (`pg_trgm`).
  - Results go through the sale rule, so nothing out of rights or out of market shows.
- **Search page** `/{m}/{l}/search/?q=`:
  - Dynamic and `noindex`. Works without JavaScript (GET form).
  - Result cards with price incl. VAT and live stock, a result count, and pagination.
  - Zero results shows suggested categories. An empty query shows popular categories.
  - The header gets a search action. (The home page has no Ask Alpha input yet; it will post here until the Advisor exists.)
- **Sitemaps and robots:**
  - `/{m}/sitemap.xml`: home, shop, categories, brands, products and legal pages published and on sale in that market, with `hreflang` alternates and `lastmod`.
  - `/sitemap.xml`: an index of the live markets.
  - `/robots.txt`: disallows `/bag`, `/checkout`, `/orders`, `/account`, `/search`, `/ops`, `/admin` and `/api`, and lists the sitemap.
- **Header navigation** links only to pages that exist (Shop, Brands, Design). Rooms and Support come back with their tasks.

## Acceptance criteria

- [x] Searching "mcintosh amp", "MA352" or a misspelling ("macintosh") in `ae/en`, and an Arabic query with or without diacritics in `ae/ar`, finds the product. A product without rights in the market, or unpublished there, is never returned.
- [x] Search works with JavaScript disabled, paginates, says how many results there are, and offers suggestions on zero results. The page is `noindex`.
- [x] Legal pages render per market and locale with a table of contents and last reviewed date. They 404 when not published in the market and refresh on publish.
- [x] `/ae/sitemap.xml` lists exactly the indexable URLs on sale in `ae` with `hreflang` alternates. `/sitemap.xml` indexes the live markets. `robots.txt` disallows every private path.
- [x] Every header and footer link resolves (no 404 from the chrome).
- [x] Integration tests cover search ranking, rights filtering and the sitemap contents. Playwright searches in `ae/en` and `ae/ar`.
