# Alpha Audio Website — Engineering Specification

Sep 25, 2026 · @Raj

## Purpose and scope

This specification defines the build of alphaaudios.com as one Payload 3 platform serving retail, distribution and projects across six GCC markets, in English and Arabic. It is the engineering companion to the Platform Technical Blueprint deck: the deck argues the design, this document specifies it page by page, field by field and rule by rule.

| In scope | Out of scope |
| --- | --- |
| Public storefront (/{market}/{locale}) for AE, SA, QA, KW, BH, OM | Native mobile apps |
| Dealer board at partners.alphaaudios.com | A general ledger, VAT returns, payroll (accounting tool) |
| Trade portal, community, My Alpha account | India operations until territory rights are agreed |
| Payload admin and the warehouse PWA | Marketing automation and CRM beyond lead handoff |
| AI Advisor, Room Lab, System Builder | Physical showroom systems (POS hardware is a browser) |
| Operations core: stock ledger, purchasing, orders, fulfilment, returns | E-invoicing transport (delegated to the accounting tool's provider) |

**Audiences and what each must be able to do**

| Audience | Must be able to |
| --- | --- |
| Consumer, any GCC market | Find a system for a room, see true stock and delivery, pay locally, book an audition, own the product afterwards |
| Dealer or integrator | Log in as a company, see own prices and stock, order or quote, register projects, receive routed leads |
| Architect or designer | Download specs, CAD and BIM, request a project quote |
| Alpha staff | Receive, count, pick, dispatch, price, approve, answer, report, without leaving the admin or the PWA |
| Engineering | Ship weekly with confidence: typed schema, tests, gates, observability, one-command environments |

**Success criteria at launch** (measured, not aspirational): every product page shows a stock-backed delivery promise; a two-buyer price-leak test passes on every release; a 200-parallel reservation test ends with zero negative stock; Core Web Vitals at the 75th percentile are green on mobile in AE and SA; every legacy URL from the old site 301s to a live page; Arabic pages are reviewed by a native writer before publish.

## Sitemap, URL scheme and redirects

Every public URL is `/{market}/{locale}/…` with market in `ae sa qa kw bh om` and locale in `en ar`; `/ae/en/` is the canonical default and `x-default`. B2B lives on `partners.alphaaudios.com`, never under the public tree, so its auth and no-cache rules cannot leak.

| Section | Route pattern | Template | Primary audience |
| --- | --- | --- | --- |
| Home | `/{m}/{l}/` | Home | Consumers |
| Shop | `/{m}/{l}/shop/{category}/{subcategory?}` | Category listing | Consumers |
| Brands | `/{m}/{l}/brands/`, `/{m}/{l}/brands/{brand}` | Brand index, Brand page | Consumers, trade |
| Product | `/{m}/{l}/products/{brand}-{model}` | Product detail | Consumers |
| Systems | `/{m}/{l}/systems/`, `/{m}/{l}/systems/{slug}` | System index, System detail | Consumers, dealers |
| Experiences | `/{m}/{l}/experiences/{hifi\|cinema\|multiroom\|smart-home\|outdoor\|acoustics}` | Experience | Consumers, developers |
| Design your system | `/{m}/{l}/design/advisor`, `/design/room-lab`, `/design/builder`, `/design/compare` | Tool pages | Consumers |
| Room blueprint (shared) | `/{m}/{l}/room-lab/r/{code}` | Blueprint | Consumers, specialists |
| Services | `/{m}/{l}/services/`, `/{m}/{l}/services/{slug}` | Service | Consumers, projects |
| Projects | `/{m}/{l}/projects/`, `/{m}/{l}/projects/{slug}` | Case study | Developers, architects |
| Journal | `/{m}/{l}/journal/`, `/{m}/{l}/journal/{slug}` | Article | Everyone, SEO |
| Community | `/{m}/{l}/community/{space}`, `/community/{space}/t/{thread}`, `/community/showcases/{slug}` | Space, Thread, Showcase | Owners |
| Visit | `/{m}/{l}/visit/`, `/{m}/{l}/visit/book` | Showroom, Booking | Consumers |
| Trade | `/{m}/{l}/trade/`, `/{m}/{l}/trade/specs/{product}` | Trade landing, Spec sheet | Architects |
| Cart and checkout | `/{m}/{l}/bag`, `/{m}/{l}/checkout`, `/{m}/{l}/checkout/complete/{order}` | Bag, Checkout, Confirmation | Consumers |
| My Alpha | `/{m}/{l}/account/{systems\|rooms\|orders\|quotes\|warranties\|service}` | Account | Customers |
| Search | `/{m}/{l}/search?q=` | Search results | Everyone |
| Legal | `/{m}/{l}/legal/{terms\|privacy\|returns\|warranty}` | Legal page | Everyone |
| Dealer board | `partners.alphaaudios.com/{catalogue\|orders\|quotes\|projects\|leads\|statements\|settings}` | Partner app | Dealers |
| Admin | `admin.alphaaudios.com` (Payload admin) | Admin | Staff |
| Warehouse PWA | `admin.alphaaudios.com/ops/{receive\|count\|pick\|dispatch\|rma}` | Ops mobile | Warehouse |

**Routing rules**

- Product slugs are `{brand}-{model}` in Latin script in every locale; titles, descriptions and headings are localized. A slug change writes a Redirects row automatically (`beforeChange` hook on `slug`).
- Market and locale are read from the path only. Geo-IP suggests a market in a dismissible banner; it never redirects. Crawlers and returning visitors keep the URL they asked for.
- `hreflang` pairs are emitted for every market and locale combination the page is published in; `x-default` is `/ae/en/`. Canonical is the page's own URL; category filters that change results get `rel=canonical` to the unfiltered page.
- Unpublished-in-market pages return 404 with the market switcher, not a redirect to another market.
- Legacy URLs (`/brand?bid=13`, `/collection?catid=53`, numeric product paths) are mapped in a `LegacyRedirects` table and resolved in Next.js middleware, because the redirects plugin matches paths only. Each is a 301 to the new URL in `/ae/en/`. The table is seeded from a crawl of the old site before cut-over and verified by a script that fetches every row and asserts 301 → 200.
- `sitemap.xml` is generated per market (`/{m}/sitemap.xml`) and indexed from `/sitemap.xml`; `robots.txt` disallows `/bag`, `/checkout`, `/account`, `/search` and all of `partners.` and `admin.`.

## Page specifications

Each template lists its rendering mode, the data it reads, its components top to bottom, the states it must handle and its SEO contract. Rendering modes: **ISR** = static with on-demand revalidation from Payload hooks; **Dynamic** = rendered per request, `Cache-Control: private, no-store`; **Fragment** = a server component streamed into an ISR page for live values (stock, price, slots).

**Global chrome (every public page)**

| Component | Behaviour |
| --- | --- |
| Header | Logo, primary nav (Shop, Experiences, Design, Services, Visit), market and language switch, search, bag count, account. Sticky on scroll, 64 px, RTL-mirrored. |
| Market switch | Lists only markets with `Markets.status = live`; switching keeps the same page when it exists in the target market, else goes to that market's home. |
| Announcement bar | From `Globals.Announcement`, per market and locale, with schedule; hidden when empty (never placeholder text). |
| Footer | Showrooms, contact, WhatsApp, service links, legal, payment logos per market, trust marks, newsletter. |
| Quiet actions | WhatsApp and Showroom Live as a small fixed cluster, hidden on checkout. |
| Consent | Cookie consent per PDPL; analytics load only after consent; strictly necessary only before. |

**Templates**

| Template | Mode | Reads | Components (top to bottom) | States | SEO |
| --- | --- | --- | --- | --- | --- |
| Home | ISR | Globals.Home, Systems (featured), Showrooms, Articles | Hero (poster then film), Ask Alpha input, three entry cards (Advisor, Room Lab, Builder), Experiences grid (Private Cinema largest), Featured systems with price incl. VAT + instalment + stock line, Showroom and Showroom Live, Journal strip | Market with no showroom hides Visit; empty featured falls back to top categories | Organization + WebSite schema, localized title and description |
| Category listing | ISR + Fragment | Categories, Products (published in market), facets | Breadcrumb, intro, facet rail (brand, price band, feature specs, in stock), sort, product cards (price incl. VAT, stock band, instalment), pagination | Zero results with suggested categories; out-of-market products never listed | ItemList schema, canonical to unfiltered, paginated `rel=next/prev` |
| Brand index | ISR | Brands with a live BrandAgreement in market | Logo grid grouped by category, filter by experience | Brands with no rights in market hidden | Localized copy per brand |
| Brand page | ISR | Brand, BrandAgreement, Products, Articles, Projects | Hero, story, product families, systems using the brand, projects, journal | Request-price brands show "request price" on cards | Brand schema |
| Product detail | ISR + Fragment | Product, Variants, Brand, StockLevels, PriceResolution (consumer), RoomProfile (session), Systems, Threads | Gallery with finish swatches, 360°, AR; title; price incl. VAT; instalment (eligibility); stock truth line (units, delivery day, install day, on display room); room-fit card; CTA pair by tier; trade-in estimate; Complete the system; Specs with explainers; Owner Q\&A; related | Out of stock → ETA + pre-order or notify; request-price → form; not sold in market → 404 with switcher | Product + Offer schema with `priceCurrency`, `availability` from ledger; AR assets as `hasVariant` |
| System index / detail | ISR + Fragment | Systems, SystemComponents, Products | Hero, components list with compatibility reasons, score, room-fit, total incl. VAT, instalment, CTA (save + audition; buy if every component allows) | Component out of stock flags the system as "orderable" with ETA | Product schema as bundle |
| Experience | ISR | Pages (block editor), Systems, Projects, Services | Editorial blocks (hero, text, media, system carousel, project carousel, service cards, FAQ) | — | Article schema for editorial |
| Advisor | Dynamic | AIProfiles (session), Products, RoomProfiles | Chat pane with chips and Arabic input, profile card (editable), candidate cards (score, price from DB), why panel, actions (save, audition, specialist) | Handoff triggers; rate limit reached → specialist CTA; no candidates → widen budget or handoff | `noindex` |
| Room Lab | Dynamic | RoomProfiles, AcousticMaterials, Measurements | Inputs panel, plan canvas (R3F), analysis panel, treatment plan, measurement upload, save and share | Guest can run but not save; unsupported browser falls back to 2D SVG | `noindex`; shared blueprint page is indexable with a noindex toggle by owner |
| System Builder | Dynamic | Products, rules, ScoringWeights | Step rail (speakers → amp/processor → source → DAC/streamer → subs → cables), candidate list per step, live score, hard-rule block messages, summary, save/quote/audition/buy | Hard-rule failure blocks the step with the reason | `noindex` |
| Compare | Dynamic | Products | Up to 4 products, spec rows with explainers, diff highlighting | — | `noindex` |
| Services | ISR | Services, Appointments | Service cards, process steps, booking CTA | — | Service schema |
| Case study | ISR | Projects | Hero, brief, system list, gallery, testimonial, similar projects | — | Article schema |
| Journal | ISR | Articles | Index with tags; article with TOC, related products (live price fragment) | — | Article schema, author, dates |
| Community space / thread / showcase | Dynamic (SSR, cache 60 s for guests) | Threads, Posts, Showcases, Badges | Space list, thread with owner badges, composer (verified owners), showcase with product links and "build this" | Moderation-held posts visible to author only | Thread pages indexable; profiles `noindex` |
| Showroom / Booking | ISR + Dynamic | Showrooms, Appointments | Rooms with systems on display today (ledger `demo` state), slot picker, Showroom Live request | Market without showroom → dealer locator | LocalBusiness schema |
| Trade landing / Spec sheet | ISR (sheet Dynamic, gated) | Products, Media (CAD/BIM) | Registration, spec library, downloads by product, project quote form | Downloads require trade login | `noindex` for sheets |
| Bag | Dynamic | Carts, PriceResolution, StockLevels | Lines with live price and stock, instalment preview, trade-in, notes, checkout CTA | Line no longer available → replaced with alternatives; price change since add → banner | `noindex` |
| Checkout | Dynamic | Carts, Markets, Reservations, Appointments | One page: contact, address (pin, Makani, national address, villa), delivery and install slots, gift, payment methods by market, summary with VAT share, TRN | Reservation expiry (15 min) with restart; payment failure with retry; BNPL declined falls back to card | `noindex`; no third-party tags except payment provider |
| Confirmation | Dynamic | Orders | Order summary, slot, WhatsApp opt-in, account creation prompt | — | `noindex` |
| My Alpha | Dynamic | Customers, OwnedSystems, Orders, Quotes, Warranties, ServiceTickets, RoomProfiles | Tabs: systems (with serials, manuals, calibration reports), rooms, orders and tracking, quotes, warranties, service tickets | Empty states with next action | `noindex` |
| Search | Dynamic | Products, Articles, Threads via hybrid search | Query, intent parse chip ("majlis, under AED 40,000"), tabs (products, systems, journal, community), facets | Zero results → Advisor handoff | `noindex` |
| Dealer board | Dynamic, no cache | Companies, PriceResolution, StockLevels (banded), Orders, Quotes, Projects, Leads, Statements | Header (company, tier, credit), catalogue with own price and RRP, quick order and CSV, cart with terms, why-this-price drawer, quotes with white-label PDF, projects, leads with acceptance timer, statements | Over-limit → approval; overdue → hold banner; allocation exhausted → request | Never indexed; `X-Robots-Tag: noindex` |
| Warehouse PWA | Dynamic, offline-capable | PurchaseOrders, SerialNumbers, StockMovements, Shipments, RMAs | Receive (scan, exceptions, confirm), Count (blind count by location), Pick (order lines, scan), Dispatch (label, photo), RMA (intake by serial) | Offline queue with sync badge; duplicate serial blocked | Not indexed |

**Component states every card and fragment must implement**: loading skeleton, empty, error with retry, and RTL mirror. A component without all four does not merge.

## Design system and component library

The UI is a token-driven library in `packages/ui`, consumed by the storefront, the dealer board and the warehouse PWA, with Payload admin styled only where it embeds custom views. Amber is spent only on the next action and on live states.

| Token | Value | Use |
| --- | --- | --- |
| lacquer | `#141B24` | Hero bands, cinema and showroom sections, dealer header |
| aluminium | `#F2F3F5`, `#D5D8DC` | Page background, dividers, image placeholders |
| graphite | `#252C34` | Body text on light |
| bronze | `#9A7B56` | Editorial accents, hairlines, secondary states |
| vu-amber | `#E3A13B` | Primary actions and live indicators only |
| signal-green | `#3F8A5F` | In stock, compatible, pass |
| alert | `#A6412A` | Errors, out of stock, hard-rule failures |
| type, Latin | Archivo (display expanded 700, text 400/600) | Headlines in the spirit of engraved faceplates; interface text |
| type, Arabic | Noto Kufi Arabic (display), IBM Plex Sans Arabic (body) | Mirrors the Latin hierarchy |
| type, data | JetBrains Mono | SKUs, prices in tables, serials, codes |
| radius | 4 px controls, 8 px cards, 0 on hero bands | Industrial, not soft |
| spacing | 4-px base, 8-step scale | Layout grid: 12 columns, 24 px gutter desktop; 4 columns, 16 px gutter mobile |
| motion | 200 ms ease-out on interface; one hero reveal per page load | Product media moves; chrome does not; `prefers-reduced-motion` honoured |

**Implementation rules**

- Tokens live in `packages/ui/tokens.css` as CSS custom properties and are mirrored into the Tailwind 4 theme; no hex values appear in components.
- Logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `text-start`); `left`/`right` classes fail lint. Direction icons (arrows, chevrons) mirror in RTL via `rtl:-scale-x-100`; logos, media controls and numerals never mirror.
- Numerals are Western digits everywhere; prices use `Intl.NumberFormat` with the market's currency and decimals; Arabic locale still uses Western digits for prices, SKUs and phone numbers.
- Every component ships with a Storybook story per state (default, loading, empty, error, RTL) and a visual regression snapshot in both directions.
- Accessibility baseline: WCAG 2.2 AA, focus visible on all interactive elements, 44 × 44 px touch targets, colour never the only signal (icons and text accompany green, amber, red).

**Component inventory** (each with props typed from Payload's generated types)

| Family | Components |
| --- | --- |
| Layout | AppShell, Header, MarketSwitch, Footer, QuietActions, AnnouncementBar, Breadcrumb, Section, Grid |
| Commerce | ProductCard, SystemCard, PriceBlock (incl. VAT, instalment, request-price), StockLine (fragment), FinishSwatches, Gallery360, ARButton, TierCTA, TradeInEstimate, CompleteTheSystem, SpecTable, SpecExplainer, BagLine, CheckoutSection, SlotPicker, AddressPin, PaymentMethodList, OrderSummary (VAT share) |
| Discovery | SearchBar, IntentChip, FacetRail, SortMenu, Pagination, CompareTable, ExperienceTile |
| Intelligence | AdvisorChat, ChipRow, ProfileCard, CandidateCard, WhyPanel, ScoreBadge, RoomInputs, RoomPlanCanvas, AnalysisPanel, TreatmentPlan, MeasurementChart, BuilderStepRail, RuleBlockMessage |
| Community | SpaceList, ThreadView, PostComposer, OwnerBadge, ShowcaseCard, ModerationNotice |
| Account | AccountTabs, OwnedSystemCard, WarrantyCard, OrderTimeline, QuoteCard, ServiceTicket |
| Dealer | CompanyHeader, CreditMeter, PartnerCatalogueTable, QuickOrder, CSVUpload, PriceTraceDrawer, QuoteBuilder, ProjectRegistrationForm, LeadCard (acceptance timer), StatementTable |
| Ops (PWA) | ScanInput, SerialList, ExceptionSheet, ProgressBar, OfflineBadge, ConfirmBar, LabelPreview, PhotoProof |
| Admin custom views | PriceRuleEditor, ViewAsBuyer, LedgerExplorer, DeadLetterList, LeadRouter, ModerationQueue |

## Content and data model

Everything is a Payload collection or global with TypeScript types generated from config; the storefront never defines its own product shape. Cost, margin and buyer prices are field-level restricted; stock is never a field, it is derived from `StockMovements`.

| Domain | Collection | Key fields | Access (read / write) |
| --- | --- | --- | --- |
| Catalog | Brands | name, slug, logo, tier, categories\[\], priceDisplay (show \| request), mapPolicy, warrantyMonths, story (localized) | public / catalogue editors |
| Catalog | BrandAgreements | brand, market, role (distributor \| retailer \| none), exclusive, validFrom, validTo, leadRouting (alpha \| dealer), complianceFlags\[\] | staff / commercial |
| Catalog | Products | title (loc), slug, brand, sku (unique, indexed), categories\[\], specs (group: sensitivityDb, impedanceOhm, minImpedanceOhm, powerW, channels, inputs\[\], outputs\[\], protocols\[\], dimensionsMm, weightKg, voltage, plug), markets\[\] (market, published, rrpInclVat, mapExclVat, priceDisplay), media\[\], models3d (glb, usdz), finishes\[\], cost (manager only), status, seo | published-in-market / catalogue editors |
| Catalog | Variants | product, finish, sku, gtin, media\[\] | as Products |
| Catalog | Categories | nested (plugin), title (loc), slug, facetSpecs\[\] | public / editors |
| Catalog | Systems, SystemComponents | title, tier (good \| better \| reference), components (product, role, qty, reason), roomClasses\[\], score, markets\[\] | public / editors |
| Catalog | AcousticMaterials | product, type, alphaByBand {125…4k}, nrc, thicknessMm, finishes\[\], fireClass, certificate | public / editors |
| Markets | Markets (global) | code, currency, decimals, vatRate, locales\[\], payments\[\], addressScheme, fulfilment (alpha \| dealer), status, showrooms\[\] | public / admin |
| Markets | TaxRates, ShippingZones, PaymentMethods, LegacyRedirects, Redirects | rates by market and category; zones with courier and SLA; methods with limits; legacy map (source query → target path) | public / admin |
| Inventory | Warehouses, Locations | code, market, type (warehouse \| showroom \| demo \| consignment \| service), address | staff / ops |
| Inventory | StockMovements | sku, serial?, qty, fromState, toState, location, docType, docId, user, reason, createdAt (insert-only; update and delete refused by access) | ops / ops (create only) |
| Inventory | StockLevels | sku, location, state, qty (derived; written only by the ledger service) | staff, banded to dealers / system |
| Inventory | SerialNumbers | serial (unique), sku, currentState, location, owner (customer \| company), warranty, history\[\] | ops, owner sees own / system |
| Inventory | Reservations | sku, location, qty, docType, docId, expiresAt, status | staff / system |
| Inventory | PurchaseOrders, GoodsReceipts, LandedCosts, Transfers, StockCounts, RMAs | supplier, lines, expectedAt, receivedLines with exceptions; cost lines (fx, freight, duty, clearing), allocation method; count sheets; RMA by serial with SLA | ops / ops, finance |
| Sales | Carts | market, locale, customer?, lines (product, variant, qty, priceSnapshot), tradeIn?, expiresAt | owner / owner |
| Sales | Orders, OrderLines | number, channel (web \| dealer \| pos \| quote), market, currency, customer or company, lines (price, trace, vat), totals, payment, shipment, slot, status, idempotencyKey (unique) | owner or company / system, staff |
| Sales | Quotes | company or customer, lines, fxLock, validUntil, whiteLabel, pdf | owner / sales |
| Sales | Shipments, Payments, InvoiceRefs, TradeIns, Appointments | courier, label, tracking events; provider, authorisation, capture; accounting document ids; unit, estimate, inspected value; room, slot, type (audition \| live \| install) | owner / system |
| B2B | Companies | name, tier, channel, territory, currency, creditLimit, terms, hold, settings (12 keys) | company users / commercial |
| B2B | CompanyUsers | company, role (owner \| purchaser \| viewer \| installer), approvalThreshold | company / commercial |
| B2B | BuyerGroups, PriceLists, PriceRules, ContractPrices, SpecialPriceRequests, ProjectRegistrations, CreditTerms, Allocations | as the price engine section; all versioned with drafts and audit | company sees own outcome / commercial, manager approval |
| B2B | Leads | source, market, brand, profiles, routedTo, acceptBy, outcome, value, fee | routed company / system |
| B2B | ApiKeys | company, scopes (feed \| orders), rateLimit, lastUsed | company owner / commercial |
| Room and AI | RoomProfiles | owner, type, dims, surfaces\[\], glazing, seating, use, results (cached), shareCode, public | owner / owner |
| Room and AI | Measurements, AIProfiles, Recommendations, AILogs | REW file, annotations; parsed profile; candidates with scores; full session log with tool calls (retention-limited) | owner / system |
| Customers | Customers, OwnedSystems, Warranties, ServiceTickets | identity, consents, market; serials owned; warranty from dispatch serial; ticket by serial with SLA | owner / support |
| Community | Threads, Posts, Showcases, Badges, ModerationQueue | space, author, status (held \| published \| removed), products linked | public read / verified owners write, moderators |
| Content | Pages, Articles, Projects, Showrooms, Services, Events, Media | block editor (hero, text, media, carousel, FAQ, CTA); SEO group; localized | public / editors |
| Settings (globals) | Announcement, Home, ScoringWeights, PricingSettings, CTAThresholds, Navigation | editable settings, no release needed | public or staff / admin |

**Cross-cutting rules**

- Localized fields carry `en` and `ar`; `ar` falls back to `en` at read time and the admin flags untranslated fields on any published document.
- `versions: { drafts: true }` on every content and pricing collection; publish requires the `publisher` role; scheduled publish uses the jobs queue.
- Field-level `access.read` on `cost`, `landedCost`, `margin`, `contractPrices`; Local API calls made on behalf of a user pass `overrideAccess: false`.
- Every collection has `createdAt`, `updatedAt`, `createdBy`; commercial and inventory collections also have an audit hook writing to `AuditLog` (actor, before, after, reason).
- Embeddings are a `vector(1536)` column added by migration on Products, Articles and Threads, refreshed by the `embedProduct` task after change.
- Hard deletes are disabled on commercial and inventory collections; documents are `archived` instead.

## APIs, webhooks and background jobs

The storefront reads through Payload's Local API inside server components; browsers only call a small set of versioned route handlers under `/api/v1`, all market-scoped and rate-limited. Payload's REST and GraphQL stay enabled for the admin and for dealer feeds with scoped keys; they are not exposed to the public storefront.

**Public and account endpoints (`/api/v1`, session cookie, CSRF token)**

| Endpoint | Method | Purpose | Notes |
| --- | --- | --- | --- |
| `/price/quote` | POST | Consumer price for product IDs in a market | Reads from Products.markets; never buyer rules; cacheable 60 s per market |
| `/stock/promise` | POST | Units, delivery day, install day, display room for product IDs | Reads StockLevels + courier cut-off + Appointments; `private, no-store` |
| `/bag` | GET, PUT | Read and update the cart | Cart id in httpOnly cookie |
| `/checkout/reserve` | POST | Reserve stock and slot for 15 minutes | Row lock transaction; returns `reservationId`, `expiresAt` |
| `/checkout/pay` | POST | Create payment intent with the market's provider | Returns hosted checkout URL or Apple Pay session |
| `/checkout/complete` | POST | Finalise order after provider webhook | Idempotent on `idempotencyKey` |
| `/advisor/session` | POST | Start or continue an Advisor session | Streams SSE; tool calls run server-side |
| `/room-lab/analyse` | POST | Run the acoustics engine on a room profile | Pure function; 200 ms budget |
| `/room-lab/rooms` | GET, POST, PUT | Saved rooms for the signed-in customer | Share code generated on save |
| `/builder/validate` | POST | Check a component set against hard and soft rules | Returns score and reasons |
| `/search` | GET | Hybrid search with intent parse | `q`, `market`, `locale`, `type` |
| `/appointments/slots` | GET | Audition, live and install slots | From Appointments and install calendar |
| `/appointments` | POST | Book a slot | Holds slot 15 minutes until confirmed |
| `/trade-in/estimate` | POST | Estimate for a model and condition | Table-driven; marked estimate |
| `/account/*` | GET | Systems, orders, quotes, warranties, tickets | Owner only |

**Partner API (`partners.alphaaudios.com/api/v1`, company session or API key)**

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/catalogue` | GET | Products with the company's resolved prices and banded stock |
| `/price/resolve` | POST | Resolve prices for lines with quantity and project; returns trace |
| `/orders` | GET, POST | Company orders; POST is idempotent on `idempotencyKey` |
| `/quotes` | GET, POST | Quotes with FX lock; `/quotes/{id}/pdf` renders white-label |
| `/projects` | GET, POST | Project registrations |
| `/leads` | GET, POST `/leads/{id}/accept`, `/leads/{id}/outcome` | Routed leads with acceptance deadline |
| `/feed/products` | GET | Content, stock bands, RRP for the dealer's site; never cost; ETag and 5-minute private cache |

**Inbound webhooks (`/api/webhooks/{provider}`, signature verified, replay-safe)**

| Provider | Events | Handler |
| --- | --- | --- |
| Payment gateway, Tabby, Tamara | authorised, captured, refunded, declined | Update Payments; complete or release order |
| Aramex, SMSA | label created, picked up, out for delivery, delivered, exception | Update Shipments; emit customer notification |
| WhatsApp Business Platform | inbound message, status | Route to lead or ticket; update delivery of templates |
| Accounting tool | invoice posted, payment received | Update InvoiceRefs and Payments |

Every webhook writes a `WebhookEvent` row first (provider, id, payload hash) and rejects duplicates before processing.

**Jobs queue tasks** (Payload jobs, retries with exponential backoff, dead-letter view in admin, replay by document id)

| Task | Trigger | Schedule or event |
| --- | --- | --- |
| `embedProduct` | Product, Article, Thread change | Event |
| `revalidateStorefront` | Any published content change | Event; calls `revalidateTag` per market |
| `releaseExpiredReservations` | — | Every minute |
| `activateScheduledPrices` | — | Every 5 minutes |
| `postInvoiceToAccounting` | Order dispatched | Event; idempotency key = order number |
| `postPaymentToAccounting` | Payment captured | Event |
| `postCogsJournal` | — | Daily 02:00 Asia/Dubai |
| `syncCourierStatus` | — | Every 15 minutes, for shipments without webhook events |
| `sendNotification` | Order, shipment, lead, ticket events | Event; WhatsApp template, email, SMS by preference |
| `routeLead` | Lead created | Event; re-route after 24 h without acceptance |
| `registerWarranty` | Shipment delivered with serials | Event |
| `generateQuotePdf` | Quote requested | Event |
| `refreshDealerStatements` | — | Nightly |
| `moderatePost` | Post created | Event; classifier then human queue |
| `purgeExpiredData` | — | Daily; enforces retention on AILogs, Measurements, Carts |

**API conventions**: JSON with `application/problem+json` errors; all money as integers in minor units with `currency` and `decimals`; timestamps ISO 8601 UTC; every response carries `X-Request-Id`; breaking changes only in a new `/v2`.

## Server logic: stock ledger, price engine, dealer board, checkout

All commercial logic lives in `packages/core` as pure services called from Payload hooks, route handlers and jobs; nothing about money or stock is computed in a browser.

**Stock ledger (`LedgerService`)**

- States: `received → available → reserved → picked → shipped → delivered`; side states `demo`, `ex_display`, `in_transit`, `bonded`, `damaged`, `rma`, `quarantine`. A state is always paired with a location.
- `move({ sku, serial?, qty, from, to, location, doc, user, reason })` inserts a `StockMovements` row and updates `StockLevels` inside one Postgres transaction with `SELECT … FOR UPDATE` on the affected level rows. Serialised SKUs move one serial per movement; bulk SKUs move quantities.
- Sellable quantity per market = sum of `available` across locations in the market's fulfilment set, minus nothing else (reservations are already moved to `reserved`).
- Reservation expiry: carts 15 minutes, quotes 7 days, project allocations per agreement, POS holds 30 minutes; `releaseExpiredReservations` moves them back.
- Counts: blind count sheets per location; variances post as movements with `docType = count` and require a reason; nobody edits a quantity.
- Invariant tests: no level below zero; sum of movements equals levels for every (sku, location, state); every serial has exactly one current state.

**Price engine (`PriceService.resolve(ctx)`)**

- Consumer price = `Products.markets[m].rrpInclVat`, shown inclusive of VAT; storefront price cannot go below `mapExclVat × (1 + vat)` (validation hook).
- Dealer price resolves in order: contract price → project price → buyer price list → group discount → volume break → dealer list (RRP excl. VAT × channel factor, or landed cost × margin); a promotion flagged stackable applies after; rounding per currency decimals; margin floor `landedCost ÷ (1 − floor)`; below floor returns `needs-approval` and opens a SpecialPriceRequest.
- Context is built from the session (company, group, market, currency), never from request parameters. The trace (rule, seen, matched, value) is stored on the order or quote line.
- Quotes lock FX and prices for their validity; scheduled price changes carry an effective date and notify affected companies 7 days before.

**Dealer board rules**

- Company scope on every query (`where: { company: { equals: session.company } }`) enforced in access functions, not in handlers.
- Stock shown per the company's visibility setting: exact, banded (`10+`, `3–9`, `Low`, `0`), or hidden; ETAs from open purchase orders when zero.
- Credit: `used = open orders + unpaid invoices`; over limit routes to approval; overdue invoices set `hold` which blocks checkout but not quoting.
- Order rules per company: minimum quantity, multiples, minimum value, free-freight threshold, drop-ship allowed; failures are explained inline, never silent.
- Leads: routed by `BrandAgreements.leadRouting` then territory; `acceptBy = createdAt + 24 h`; unanswered leads re-route and the event is logged.
- White-label quotes: PDF rendered server-side with the dealer's logo and markup; Alpha cost never present in the template's data.

**Checkout state machine**

| State | Entered by | Exits to | Timeout |
| --- | --- | --- | --- |
| bag | add to bag | reserving | cart expiry 7 days |
| reserving | checkout start | reserved, unavailable | — |
| reserved | stock and slot held | paying, expired | 15 minutes |
| paying | payment intent created | paid, failed | provider timeout |
| paid | provider webhook captured or authorised | confirmed | — |
| confirmed | order written, notifications queued | picking | — |
| failed, expired | webhook or job | bag (with message) | — |

- Totals: prices incl. VAT; VAT shown as `total × rate ÷ (100 + rate)`; installation and delivery as separate lines with their own rates; trade-in as a credit line marked estimate.
- Payment methods filtered by market, basket value and provider eligibility; cash on delivery capped per market; Apple Pay first on Safari.
- Order write is idempotent on `idempotencyKey`; a duplicate webhook cannot create a second order.
- On confirmation: `registerWarranty` runs at delivery, not at payment; the customer account is created or linked by verified mobile.

## Intelligence: AI Advisor, Room Lab, System Builder

The three tools share one profile and one deterministic engine; the language model interprets and explains, and never chooses a product or states a figure it did not receive from a tool.

**AI Advisor**

- Pipeline: intent (chat or Ask Alpha input, EN or AR) → structured profile (JSON, editable) → candidate filter in SQL (market rights, stock or ETA, compatibility, room class, budget) → scoring → explanation with tool calls → cards rendered from the database.
- Tools: `searchCatalogue`, `buildCandidates`, `checkCompatibility`, `getRoomAnalysis`, `getAvailability`, `createBlueprint`, `bookAudition`, `handoffToSpecialist`; JSON Schema definitions behind a provider abstraction (`packages/llm`) so the vendor can change without touching business logic.
- Guardrails: the system prompt forbids figures not returned by tools; responses are post-checked so any price, stock or spec number in the text matches a tool result or is removed; handoff is automatic above AED 250,000, for custom installation, on negative sentiment, or when the top score is below the threshold in `ScoringWeights`.
- Evaluation: a versioned set of at least 200 questions in English, Modern Standard Arabic and Gulf dialect with expected candidates, compatibility verdicts and tone; runs in CI on every prompt or model change; a regression blocks the release.
- Privacy and cost: sessions stored with consent and purged per retention; per-session and per-IP rate limits; embeddings cached by content hash; streaming via SSE with a hard 30-second cap.

**Room Lab engine (`packages/acoustics`, pure TypeScript, no I/O)**

- Inputs: type (majlis, cinema, living, listening), dimensions, surfaces with area, glazing share, seating layout, use, listening distance, target peaks.
- Outputs per octave band 125 Hz–4 kHz: volume, axial modes, Sabine RT60 before and after a treatment plan, required amplifier power at the seat, screen width range, layout recommendation, placement notes; formulas as in the blueprint deck.
- Materials come from `AcousticMaterials` with per-band absorption, so the "after" figure is a real, buyable plan; the plan lists products, quantities and price.
- Majlis preset: seats along three walls, wide-dispersion weighting, two subwoofers at mid-walls, dialogue clarity weighting.
- Plan canvas: React Three Fiber orthographic top view; draggable speakers and seats; 2D SVG fallback when WebGL is unavailable; results recompute under 200 ms on input change.
- Measurements: Room EQ Wizard text export parsed server-side, plotted with the model prediction, annotated by an acoustician, compared before and after; files are private to the room's owner.
- Blueprints: saving writes a `RoomProfile` with a share code and, if the customer opts in, a lead with the full analysis attached.

**System Builder**

- Hard rules (block): impedance stability, channel count for the layout, connections match, 230 V and Type G plug or adapter, market rights and stock or ETA. Soft factors (score): room match, compatibility, power headroom, design fit, budget fit, streaming ecosystem, physical fit.
- Score `= 100 × (0.30R + 0.25C + 0.20H + 0.15D + 0.10B)`; any hard failure sets 0; weights live in `ScoringWeights` and are versioned so past recommendations can be replayed.
- Every rule check returns a reason string in both languages; the UI never shows a bare failure.
- Saved systems keep a price snapshot; turning one into a quote locks prices and FX for the quote's validity.
- Calls to action by tier from `CTAThresholds`: accessories add to bag; mid-range add to bag plus ask a specialist; high-end add to bag or request price where the brand requires; complete systems save and book an audition, buy online only when every component allows; projects design my system plus site visit.

## GCC market layer

A market is a record, not a code branch: currency, decimals, VAT, locales, payment rails, address scheme, fulfilment mode and brand rights all come from `Markets` and `BrandAgreements`, and every query, price and template reads them.

| Market | Currency (decimals) | VAT | Payment rails | Address scheme | Fulfilment |
| --- | --- | --- | --- | --- | --- |
| UAE (ae) | AED (2) | 5% | Cards, Apple Pay, Google Pay, Tabby, Tamara, cash on delivery capped | Map pin + Makani (Dubai) + villa/building | Alpha warehouse and install team |
| Saudi Arabia (sa) | SAR (2) | 15% | mada, cards, Apple Pay, Tabby, Tamara | National address (short address code) | Dealer or Alpha via SMSA, by rights |
| Qatar (qa) | QAR (2) | none | NAPS, cards, Apple Pay | Zone, street, building | Dealer |
| Kuwait (kw) | KWD (3) | none | KNET, cards | PACI number | Dealer |
| Bahrain (bh) | BHD (3) | 10% | BenefitPay, cards | Block, road, building | Dealer |
| Oman (om) | OMR (3) | 5% | OmanNet, cards | Way, building, PO box | Dealer |

**Localisation**

- Payload `localization` with `en` and `ar` (`rtl: true`), fallback to `en`; `html[dir][lang]` set per route; every layout uses logical properties; RTL snapshot tests run on every component.
- Arabic copy is written by a native writer; AI drafts are marked `draft` and cannot be published without review; Arabic search normalises alef variants, taa marbuta and diacritics before indexing.
- Dates in Gregorian with the market's timezone; Hijri shown alongside only on booking confirmations where the market prefers it.

**Money**

- All amounts stored as integers in minor units with `currency` and `decimals`; three-decimal currencies round half-up at the last step; VAT computed per line and summed, never on totals.
- Prices are entered per market in the product record; no automatic FX on consumer prices. Dealer quotes lock FX from `PricingSettings.fxRates` with a timestamp.

**Addresses and delivery**

- Address capture is pin-first with Google Maps Platform or Mapbox, scheme-specific fields per market, and a WhatsApp location share fallback; the pin is sent to the driver.
- Delivery promise = ledger stock in the fulfilment location + courier cut-off + zone SLA + install calendar; shown as a day, never a time window unless a slot is chosen.
- Couriers: Aramex across the GCC, SMSA for Saudi Arabia; labels created on pick confirmation; tracking webhooks feed WhatsApp updates.

**Compliance in-market**

- Tax invoices carry the market's required fields (TRN, VAT breakdown, bilingual for Saudi Arabia); B2B invoices are issued by the accounting tool and transmitted by its accredited e-invoicing provider in PINT AE for the UAE.
- Brand compliance flags (for example origin restrictions) hide a brand in a market and block dealer orders into it.
- Consent and privacy notices per market under UAE and Saudi PDPL; data residency in the UAE region; cross-border transfers documented.

## Engineering standards

One monorepo, one pinned toolchain, one path to production. A change ships only through a pull request that passes the gates below; nothing is deployed by hand.

**Repository (`alpha-platform`, pnpm workspaces, Turborepo)**

| Path | Contents |
| --- | --- |
| `apps/web` | Next.js 16 storefront + Payload admin (one app, one process) |
| `apps/partners` | Dealer board (Next.js), shares `packages/*`, separate deployment and domain |
| `apps/ops` | Warehouse PWA route group deployed with admin |
| `packages/payload` | Collections, globals, hooks, access, jobs, migrations |
| `packages/core` | Ledger, price engine, checkout, lead routing (pure services) |
| `packages/acoustics` | Room Lab engine |
| `packages/llm` | Provider abstraction, tools, prompts, evaluation harness |
| `packages/ui` | Tokens, components, Storybook |
| `packages/config` | ESLint, TypeScript, Tailwind, Prettier presets |
| `infra` | Terraform for UAE region, Cloudflare, secrets layout; Dockerfiles |
| `docs` | ADRs, runbooks, this specification's engineering appendices |

**Toolchain and code rules**

- Node LTS pinned in `.nvmrc`; pnpm version pinned in `packageManager`; Payload pinned to a minor (`3.89.x` today) with a monthly upgrade PR; Next.js version follows Payload's peer range.
- TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; no `any` without an `// reason:` comment; Payload types regenerated in CI and committed, diff must be empty.
- ESLint with `@typescript-eslint` strict, `eslint-plugin-jsx-a11y`, an RTL rule banning physical direction classes, an import-boundary rule (apps import packages, never the reverse), and a rule banning `overrideAccess: true` outside `packages/payload/system`.
- Prettier as the only formatter; Conventional Commits (`feat(pricing): …`); squash merge; branch names `type/scope-short-title`.
- Every collection change is a Payload migration committed with the PR; migrations run in CI against a fresh database and against a production snapshot.
- Secrets only from the platform secret store; `.env.example` documents every variable; a startup check fails fast on missing variables.
- Architecture Decision Records in `docs/adr/NNNN-title.md` for any change to stack, data model boundaries, integrations or security posture.

**Code review**: two approvals for `packages/core`, `packages/payload` and anything under `security`; one elsewhere; the author never merges their own PR; review checklist covers access control, market awareness, RTL, tests and migrations.

**Testing pyramid**

| Layer | Tool | What must be covered |
| --- | --- | --- |
| Unit | Vitest | Ledger invariants, price engine rules and rounding, VAT maths, acoustics formulas, address schemes; 90% line coverage in `packages/core` and `packages/acoustics` |
| Integration | Vitest + Testcontainers Postgres | Payload hooks, access functions, migrations, jobs; the two-buyer price-leak test; reservation concurrency (200 parallel) |
| Contract | Pact-style JSON fixtures | Webhooks from payment, courier, WhatsApp providers; partner API responses |
| End-to-end | Playwright | Checkout in AE and SA in both locales; dealer order with approval; receiving flow in the PWA; Advisor session with mocked LLM |
| Visual | Storybook + Chromatic (or Playwright screenshots) | Every component in LTR and RTL |
| Performance | Lighthouse CI + k6 | Budgets in the next section; k6 on `/checkout/reserve` and `/price/resolve` |
| AI evaluation | `packages/llm/eval` | 200-question EN, MSA and Gulf set; blocks on regression |

**CI/CD (GitHub Actions)**

1. On PR: install, type-check, lint, unit and integration tests, migrations on fresh DB, build, Storybook build, Lighthouse CI on three pages, AI eval when prompts or tools changed; a preview environment per PR with seeded data.
2. On merge to `main`: deploy to staging (production snapshot, anonymised), run E2E and k6; a release is a tagged commit with an auto-generated changelog.
3. Production deploy: manual approval by an engineering lead; blue-green with database migrations run before the switch and verified backward-compatible for one release; automatic rollback on health-check failure.

**Environments**

| Environment | Data | Purpose |
| --- | --- | --- |
| local | Docker Compose: Postgres, MinIO, mail catcher | Development; `pnpm dev` starts everything |
| preview | Seeded fixtures | One per PR, torn down on merge |
| staging | Anonymised production snapshot, refreshed weekly | E2E, load tests, UAT |
| production | Live | UAE region, blue-green |

**Definition of done for any feature**: typed schema and migration; access rules tested; both locales and RTL; loading, empty and error states; telemetry events named; runbook or ADR updated where relevant; feature flag for anything customer-visible.

## Performance, SEO and accessibility standards

Budgets are enforced in CI (Lighthouse CI and bundle analysis) and monitored in production from real users (Core Web Vitals per market at the 75th percentile). A budget breach on `main` blocks the release.

| Area | Budget | Measured by |
| --- | --- | --- |
| Largest Contentful Paint | ≤ 2.5 s mobile, ≤ 1.8 s desktop | RUM p75 per market; Lighthouse CI |
| Interaction to Next Paint | ≤ 200 ms | RUM p75 |
| Cumulative Layout Shift | ≤ 0.1 | RUM p75 |
| Time to First Byte | ≤ 500 ms ISR pages from GCC; ≤ 800 ms dynamic | Synthetic from Dubai and Riyadh |
| JavaScript per route | ≤ 170 KB gzip on product and category; ≤ 250 KB on tool pages (proposed, confirmed in sprint 1) | `next build` bundle report in CI |
| Images | AVIF/WebP via Cloudflare Images, `sizes` on every `img`, LCP image preloaded, no image over 200 KB above the fold | Lint rule + Lighthouse |
| Fonts | Latin and Arabic subsets, preloaded, `font-display: swap`, ≤ 4 files on first paint | Bundle report |
| 3D and AR | glTF ≤ 3 MB Draco-compressed, loaded on tap; USDZ generated offline | Asset pipeline check |
| Hero film | Poster paints first; video loads after interaction; ≤ 6 MB, streaming service | Manual + Lighthouse |
| Server | p95 ≤ 300 ms for `/stock/promise`, ≤ 400 ms for `/price/resolve`, ≤ 200 ms for `/room-lab/analyse` | OpenTelemetry traces |

**Caching**

- ISR pages tagged by market and document; `revalidateTag` on publish; edge TTL 1 hour with stale-while-revalidate 1 day.
- Fragments and dynamic routes `private, no-store`; partner and account domains bypass the CDN entirely.
- Hybrid search results cached 60 s per (market, locale, query); price quotes 60 s; stock promises never.

**SEO**

- Server-rendered HTML for every indexable page; no client-only content in the first viewport.
- Structured data: Organization, WebSite with SearchAction, Product and Offer (availability from the ledger), ItemList, BreadcrumbList, Article, LocalBusiness per showroom, FAQ where present; validated in CI with a schema test.
- Titles and descriptions per locale from the SEO group with sensible defaults; `hreflang` and canonical rules from the sitemap section; Open Graph images generated per product and market.
- Redirect verification job runs after every deploy against the LegacyRedirects table and alerts on any non-301.
- Search Console properties per market path and per domain; Core Web Vitals report reviewed weekly.

**Accessibility (WCAG 2.2 AA)**

- Semantic landmarks, one `h1` per page, skip link, focus order matching reading order in both directions.
- Contrast ≥ 4.5:1 for text (amber is used on dark or as a fill with dark text, never as small text on light).
- All interactive components keyboard-operable; slot pickers and swatches expose names and states; live regions for stock and price updates.
- Forms: labels, inline errors tied by `aria-describedby`, autocomplete attributes, mobile numeric keyboards for phone and codes.
- Media: captions on films, `alt` on product images generated from structured data and reviewed; AR has a text alternative.
- Automated axe checks in Storybook and Playwright; a manual screen-reader pass in Arabic and English before each public phase.

## Security, privacy and compliance

The two things that must never happen are a buyer seeing another buyer's price and a customer's room data leaking; the controls below are built around those, then the general baseline.

**Identity and access**

| Actor | Authentication | Authorisation |
| --- | --- | --- |
| Staff | Payload auth with SSO (OIDC) where available, 2FA mandatory, session 8 h | Roles: admin, commercial, catalogue editor, publisher, ops, support, finance, moderator; field-level cost and margin |
| Company users | Email + password with 2FA optional, magic link; session 24 h | Company scope in access functions; roles owner, purchaser, viewer, installer; approval thresholds |
| Customers | Verified mobile (OTP via WhatsApp or SMS) or email magic link; passkeys offered | Own records only |
| API keys | Company-scoped keys, hashed at rest, scopes and rate limits, rotation reminder at 180 days | Feed and orders scopes only |
| Webhooks | HMAC signature per provider, timestamp tolerance 5 minutes, replay table | Provider-specific handlers only |

**Application controls**

- Every access function is a unit test; the two-buyer leak test and a staff-versus-company test run on every PR.
- `view as buyer` is a separate audited session with a banner; it cannot place orders.
- Input validation with Zod at every route handler; Payload validation on every field; file uploads type-checked, virus-scanned, stored private with signed URLs.
- CSRF tokens on state-changing requests; SameSite=Lax cookies, `Secure`, `HttpOnly`; strict Content-Security-Policy with nonces (payment provider and maps allow-listed); HSTS preload; Referrer-Policy strict-origin-when-cross-origin.
- Rate limits at Cloudflare and in-app on auth, search, Advisor, reserve and webhook routes; WAF managed rules plus custom rules for the partner domain (country allow-list for the GCC, review for exceptions).
- Secrets in the platform secret store, never in the repo; rotation runbook; least-privilege database roles (app, migrations, read-only reporting).
- Dependencies: Dependabot weekly, `pnpm audit` in CI, Payload security advisories tracked (3.86 patched CVE-2026-46625); critical patches within 48 hours.

**Data protection (UAE PDPL, Saudi PDPL)**

| Data | Basis | Retention | Notes |
| --- | --- | --- | --- |
| Customer identity, orders, warranties | Contract | Life of the relationship + statutory period | Export and deletion requests handled in the admin within 30 days |
| Room profiles, floor plans, photos, measurements | Consent | Until deleted by the owner; 24 months of inactivity then purged | Private storage, signed URLs, never used for training |
| Advisor sessions and AI logs | Consent | 90 days, then aggregated | Rate-limited; opt-out honoured |
| Analytics | Consent | Provider default, IP truncated | Loads only after consent |
| Dealer commercial data | Contract | Life of agreement + statutory | Company-scoped, audited access |

- Records of processing and a data map maintained in `docs/privacy`; a DPIA for Room Lab and the Advisor before launch.
- Data residency: primary database, backups and object storage in the UAE region; the LLM provider's region and retention terms documented; no personal data in prompts beyond what the profile needs.

**Payments and tax**

- Card data never touches Alpha servers: hosted fields or redirect; SAQ-A scope; provider tokens only.
- Tax invoices from the accounting tool; B2B e-invoicing through its accredited provider (PINT AE, UAE); invoice numbers immutable; credit notes for corrections.

**Audit and evidence**

- `AuditLog` for commercial, inventory and access changes, retained 7 years, exportable.
- Quarterly access review; annual penetration test on the storefront, partner domain and admin; findings tracked to closure.

Not legal or tax advice; confirm obligations with counsel and the accountant.

## Observability, runbooks and maintenance

The platform is instrumented so that a failed checkout, a mispriced line or a stuck sync is visible within minutes, and maintained on a fixed cadence so it does not drift.

**Telemetry**

| Signal | Tool | What is captured |
| --- | --- | --- |
| Errors | Sentry (web, partners, jobs) | Exceptions with release, market, locale, request id; PII scrubbed |
| Traces | OpenTelemetry → hosted collector | Route handlers, Payload hooks, DB queries, external calls, job runs; sampled 10%, 100% on errors |
| Metrics | Collector → dashboards | Request rate and latency per route, job queue depth and age, reservation conflicts, webhook lag, cache hit ratio, LLM tokens and cost |
| Real-user monitoring | Web Vitals beacon | LCP, INP, CLS per market, locale, template |
| Business events | Event table + warehouse export | `product_viewed`, `promise_shown`, `bag_added`, `reserve`, `paid`, `advisor_session`, `blueprint_saved`, `lead_routed`, `lead_accepted`, `quote_created`, `order_placed_partner` |
| Uptime | External checks from Dubai and Riyadh | Home, product, checkout reserve, partner login, admin login, every 1 minute |

**Alerts (paged to the on-call engineer)**

- Checkout: payment webhook lag over 2 minutes; reserve error rate over 1%; any negative stock level (should be impossible).
- Pricing: any `needs-approval` volume spike; the two-buyer test failing in production canary; price resolve p95 over 400 ms.
- Jobs: dead-letter count above 0 for accounting or e-invoicing tasks; queue age over 10 minutes.
- Integrations: courier or WhatsApp webhook silence over 30 minutes during working hours; LLM error rate over 5% or daily spend over budget.
- Platform: error rate over 1% for 5 minutes; uptime check failing twice; database connections over 80%; disk or backup failure.

**Runbooks (`docs/runbooks`)**

| Runbook | Covers |
| --- | --- |
| Deploy and rollback | Blue-green switch, migration verification, rollback to previous release |
| Database restore | Point-in-time recovery to a new instance, verification queries, cut-over |
| Stuck reservations | Diagnose expiry job, manual release with reason, customer communication |
| Price incident | Freeze price lists, replay traces, correct and notify affected companies |
| Payment provider outage | Fall back to alternative methods per market, queue captures |
| Courier outage | Manual labels, hold notifications, resume sync |
| Accounting sync failure | Inspect dead letters, replay by document id, reconcile totals |
| LLM provider outage or drift | Disable Advisor with graceful fallback to specialist handoff; re-run evaluation |
| Security incident | Contain, rotate secrets, preserve logs, notify per PDPL timelines |
| Legacy redirect regression | Run verification script, patch table, redeploy middleware |

**Maintenance cadence**

| Cadence | Task |
| --- | --- |
| Daily | Dead-letter review; backup success check; Core Web Vitals glance |
| Weekly | Dependabot merges; error triage; staging refresh from anonymised snapshot; Search Console review |
| Monthly | Payload minor upgrade PR; restore drill from backup; access review of API keys nearing rotation; AI evaluation re-run on the current model |
| Quarterly | Staff access review; cost review (hosting, LLM, media); performance budget review; ADR review |
| Annually | Penetration test; DPIA refresh; disaster-recovery exercise; brand rights and market records audit |

**Backups**: Postgres continuous WAL archiving with point-in-time recovery, daily snapshots retained 35 days, monthly retained 12 months; object storage versioned; restore time objective 1 hour, recovery point objective 5 minutes.

## Delivery: phases, gates and open decisions

Five phases in dependency order, each with a release gate that must pass before the next starts; the calendar is set once the decisions below are made.

| Phase | Scope | Gate to leave the phase |
| --- | --- | --- |
| P0 Foundations | Monorepo, CI/CD, environments, Payload skeleton with markets and locales, design tokens, Storybook, observability, ADR 0001–0010 | A hello-world page deploys blue-green with a migration; preview environments per PR; alerts firing to on-call |
| P1 Operations core | Ledger, serials, purchasing, landed cost, receiving PWA, counts, orders model, showroom POS, accounting sync, opening stock count | Ledger invariants green; 200-parallel reservation test; receiving used by staff on real stock for at least one full cycle; accounting reconciliation matches |
| P2 Storefront and dealer board | UAE in EN and AR: all public templates, checkout, payments, couriers, WhatsApp; partners domain with catalogue, prices, orders, quotes, projects, leads; legacy redirects | Two-buyer leak test; Core Web Vitals green on staging; redirect verification 100%; native Arabic review complete; Playwright suites green in both locales |
| P3 Intelligence | AI Advisor, Room Lab, System Builder, Compare, hybrid search, My Alpha rooms | AI evaluation set at target; acoustics engine unit tests; Advisor handoff to WhatsApp verified end to end |
| P4 Depth | Community, acoustics catalogue, trade portal and spec library, allocation, feeds, white-label quotes, dealer statements | Moderation queue live in both languages; feed contract tests; statements reconcile |
| P5 Expansion | Saudi Arabia (mada, national address, SMSA, 15% VAT), then QA, KW, BH, OM by rights; AR assets; Showroom Live; e-invoicing cut-over | Per-market checklist: rails, tax, address, courier, brand rights, legal pages, Search Console |

**Definition of done, whole platform**

- Every success criterion in section 1 is measured and green in production.
- Every runbook has been exercised at least once on staging.
- All ADRs current; no `TODO` or `FIXME` without an issue link; dependency audit clean.
- Staff trained: admin, PWA, price approvals, moderation, dead-letter replay.

**Open decisions** (each blocks the phase named)

| Decision | Blocks | Owner |
| --- | --- | --- |
| Accounting tool and its accredited e-invoicing provider | P1 | \[Owner\] |
| Opening stock count date and method (serial capture) | P1 | \[Owner\] |
| Courier accounts (Aramex, SMSA) and label formats | P1 | \[Owner\] |
| UAE hosting account and secret store | P0 | \[Owner\] |
| Card gateway (Checkout.com, Network International or Stripe) and BNPL contracts (Tabby, Tamara) | P2 | \[Owner\] |
| Final brand list with territory rights per market | P2 | \[Owner\] |
| Arabic content owner and review process | P2 | \[Owner\] |
| Maps provider (Google Maps Platform or Mapbox) | P2 | \[Owner\] |
| LLM provider after the Arabic and Gulf-dialect evaluation | P3 | \[Owner\] |
| Acoustic treatment and seating brands with absorption and fire data | P4 | \[Owner\] |
| JavaScript budget confirmation (170 KB proposed) | P0 | Engineering lead |
| Analytics and consent management provider | P2 | \[Owner\] |

**Risks carried from the strategy review**: distribution rights per market undefined; product data enrichment effort underestimated; Arabic "day one" versus "Arabic-ready" resolved in favour of day one; e-invoicing and PDPL previously absent; legacy URL migration previously unplanned; majlis mode and hard surfaces now in the engine; India scope deferred until rights are agreed.
