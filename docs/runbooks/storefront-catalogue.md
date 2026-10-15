# Runbook — storefront catalogue

How products reach the storefront, and what to check when a page looks wrong. Read ADR 0006 for the design.

## Publishing

- A product is on sale in a market when it is **published** (the Publish button, not Save draft) and its **Markets** row for that market has **Published** ticked.
- Price is **RRP incl. VAT** in minor units of the market currency: AED 34,500.00 is `3450000`, KWD 125.500 is `125500`. "On request" on the row, or on the brand, hides the price everywhere.
- Publishing expires the storefront cache at once. The next visit renders fresh, and a page unpublished in a market returns 404 with the market switcher.
- Arabic copy stays `draft` under **Arabic review** until the native reviewer marks it reviewed.

## Brand rights

- A product shows in a market only if its brand has a **live brand agreement** there (Catalogue → Brand agreements): role distributor or retailer, today inside valid from / valid to, and no `origin-restriction` or `registration-pending` flag.
- To stop selling a brand in a market, set **Valid to** on its agreement (never delete it). To restart, add a new agreement starting on or after that date; overlapping agreements are refused.
- A brand with no live agreement disappears from the brand index, its brand page returns 404, and its products are hidden everywhere in that market, even though they stay published.

## Something looks stale

| Symptom                                        | Why                                                                  | Do                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Published change not visible                   | Saved as a draft, or the CDN still holds the page (up to 5 minutes)  | Check the document shows "Published"; wait 5 minutes or purge the URL at the CDN               |
| Stock line wrong on first paint, then corrects | The page HTML is from the last render; the live line asks the ledger | Nothing; the live line is the truth. Check the ledger explorer if the corrected value is wrong |
| Stock line never updates                       | `/api/v1/markets/{m}/stock` failing                                  | `curl '/api/v1/markets/ae/stock?sku=SKU'`; expect 200 and `private, no-store`                  |
| Product shows "Price on request" unexpectedly  | Brand set to on request, row set to on request, or no RRP            | Fix the brand or the market row                                                                |
| Product 404 in a market                        | Not published, or not published in that market                       | Tick the market row's Published and publish                                                    |
| Images missing                                 | Media object missing in storage                                      | Open the media document in the admin; re-upload                                                |

## Category listings and filters

- `/shop/` lists everything sold in the market; `/shop/{category}/` and `/shop/{category}/{subcategory}/` list a category and everything below it.
- **Filters** are brand, price band (derived from the prices in the category), in stock, and the spec fields chosen under **Facet specs** on the category (a subcategory without its own uses its parent's). A spec with only one value in the category is not offered.
- Filtered URLs (`?brand=…`) render live on every request and are `noindex`; the plain category URL is the cached, indexed page.
- A product missing from a listing is not published, not published in that market, or not in that category (or one below it).

## Stock line states

`In stock` (more than 2 sellable), `Only a few left` (1–2), `Available to order` with the earliest open purchase order date, or `Out of stock`. Sellable is `available` stock across the market's sellable locations.

## Search

- Search (`/{m}/{l}/search/?q=`) matches the product title, brand, SKU, category names and summary. It tolerates small typos ("macintosh"), and Arabic with or without diacritics. Only products on sale in the market are shown.
- The index updates itself when a product, brand or category is published: database triggers maintain `product_search`. If results look stale after a bulk SQL change, run `SELECT alpha_refresh_product_search(id) FROM products;`.
- A product missing from search but visible on its page: check its title in that locale, and that it is published (search ignores drafts).

## Legal pages

- Terms, privacy, returns and warranty live in **Content → Pages** (kind legal), one document each, published per market (**Markets**). Set **Reviewed at** after each legal review; the page shows it.
- The seeded copy (`seed:content`) is a draft and says so in its first paragraph. Replace it before launch.
- The footer lists the legal pages published in the market. A page not published in a market returns 404 there.

## Sitemaps and robots

- `/sitemap.xml` indexes `/{m}/sitemap.xml` for each live market. Each market's sitemap lists the pages on sale there, in each of its languages, with hreflang alternates. Submit `/sitemap.xml` in Search Console.
- `robots.txt` keeps bag, checkout, orders, account, search, `/ops`, `/admin` and `/api` out of crawlers.

## Local demo data

```
pnpm --filter @alpha/web seed:markets
pnpm --filter @alpha/web seed:inventory
pnpm --filter @alpha/web seed:purchasing
pnpm --filter @alpha/web seed:catalog
pnpm --filter @alpha/web seed:content
```

`seed:catalog` uploads generated images, so the media storage (MinIO in `docker compose`) must be running. It books opening stock and an open purchase order when the demo warehouse exists.
