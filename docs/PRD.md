# S.com Data Platform — Product Requirements Document

## 1. Product vision

S.com Data Platform is an open, text-first data layer for Samsung.com.

It continuously discovers and normalizes public Samsung.com content across markets so AI agents and developers can query the latest product, support, campaign, and page information without repeatedly crawling Samsung.com themselves.

The platform is designed to start at effectively zero infrastructure cost.

## 2. Core principles

1. **Text first** — no image mirroring or image processing in the core dataset.
2. **Current by default** — most page data is overwritten on each successful crawl.
3. **History only where valuable** — product identity, specifications, price/offer metadata, and other product facts can retain change history.
4. **Market aware** — every record carries market/country/language context.
5. **Agent native** — MCP is a first-class interface, not an afterthought.
6. **Open and portable** — the canonical dataset is ordinary JSON/JSONL files in Git.
7. **Zero-cost first** — GitHub repository + GitHub Actions + GitHub Pages are the default infrastructure.
8. **Respectful crawling** — obey robots directives where applicable, use a clear user agent, throttle requests, and keep crawl volume bounded.

## 3. Target users

- AI/agent builders that need Samsung.com facts
- Samsung.com analysts and product managers
- Developers comparing content or product information across markets
- Researchers tracking product/spec changes over time

## 4. Primary use cases

### UC-1 Search Samsung.com across markets
A client asks for a topic or model name and receives relevant Samsung.com pages with source URLs and market metadata.

### UC-2 Compare markets
A client asks how the same product/topic appears in two or more markets.

### UC-3 Retrieve a canonical page
A client requests the normalized text and metadata for a known Samsung.com URL.

### UC-4 Track product changes
A client requests historical versions of a product record and sees when normalized product facts changed.

### UC-5 Reuse through MCP
An AI host connects to the repository's MCP server and uses the dataset as tools.

## 5. Data scope

### In scope for current snapshots
- product pages
- product category/listing pages
- support pages
- buying guides
- campaign/editorial pages
- service/information pages
- public page title, description, canonical URL, normalized visible text

### History candidates
- product model/SKU
- product name
- structured product facts exposed in public structured data
- price/currency/availability when publicly exposed
- canonical product URL
- future normalized specification fields

### Out of scope for v0
- images and binaries
- authenticated/private content
- cart/account/order data
- bypassing access controls or anti-bot protections
- pixel-perfect page snapshots

## 6. Storage model

The repository itself is the first database.

```text
data/
  current/
    {market}/
      pages.jsonl
      products.jsonl
      meta.json
  history/
    products/
      {market}.jsonl
```

`current` is replaced by each successful crawl.

`history/products/{market}.jsonl` only grows when a product fingerprint changes.

This avoids paying for a database before the dataset actually needs one.

## 7. Canonical page schema

```json
{
  "id": "sha256-derived-id",
  "market": "us",
  "url": "https://www.samsung.com/us/...",
  "canonical_url": "https://www.samsung.com/us/...",
  "title": "...",
  "description": "...",
  "text": "...",
  "captured_at": "ISO-8601 timestamp",
  "content_hash": "sha256"
}
```

## 8. Canonical product schema

```json
{
  "key": "stable-product-key",
  "market": "us",
  "url": "...",
  "name": "...",
  "sku": "...",
  "model": "...",
  "brand": "Samsung",
  "offers": {
    "price": "...",
    "currency": "...",
    "availability": "..."
  },
  "captured_at": "...",
  "fingerprint": "sha256"
}
```

The first extractor uses public JSON-LD when a page exposes a Product object. Later extractors may add Samsung-specific specification normalization.

## 9. Crawling strategy

### Discovery
1. Read the market's `robots.txt`.
2. Collect declared sitemap URLs.
3. Fall back to `/sitemap.xml` when needed.
4. Walk sitemap indexes with bounded recursion.
5. Prioritize likely product/support URLs.

### Fetching
- Node 20 native `fetch`
- explicit project user agent
- same-origin filtering
- configurable delay
- configurable maximum page count
- timeout per request
- retry can be added in v1

### Normalization
- remove script/style/noscript/svg/image markup
- extract title, meta description, canonical URL
- normalize visible text whitespace
- parse Product JSON-LD when available
- store no image payloads

## 10. MCP interface

v0 tools:

- `list_markets`
- `search_scom`
- `get_page`
- `compare_markets`
- `get_product_history`

The MCP server is local/stdio first. This costs nothing to host and lets any compatible desktop/IDE/agent spawn it after cloning the repository.

A hosted Streamable HTTP MCP endpoint is a later optional layer. The same data/query core should be reused.

## 11. Frontend

A static public introduction/explorer is hosted on GitHub Pages.

v0 pages/features:
- product explanation
- architecture overview
- current market/crawl status
- MCP setup instructions
- simple dataset browser links

Later:
- client-side full-text search index
- market comparison UI
- product history timeline
- crawl health dashboard

## 12. Automation

GitHub Actions performs:

1. scheduled crawling
2. data validation
3. commit of changed snapshots/history
4. GitHub Pages deployment

No always-on server is required for v0.

## 13. Non-functional requirements

### Cost
Target recurring infrastructure cost for v0: **$0** using public GitHub repository resources.

### Traceability
Every result must preserve the Samsung.com source URL.

### Freshness
Initial target: daily scheduled crawl. Large-scale operation should rotate markets and prioritize changed sitemaps/pages.

### Reliability
A failed market crawl must not erase its previous successful snapshot.

### Repository growth
If Git history becomes too large:
1. reduce retained current text size,
2. shard data,
3. move generated snapshots to release artifacts/object storage,
4. keep schemas/MCP code in Git.

## 14. Success metrics

- number of active markets
- crawl success rate
- pages captured per market
- percentage of records with canonical URLs
- structured products extracted
- query latency from MCP
- history records generated only on meaningful change

## 15. Delivery phases

### Phase 0 — repository MVP
- PRD
- market registry
- sitemap crawler
- JSONL current storage
- JSON-LD product extraction
- product change history
- stdio MCP
- static frontend
- GitHub Actions

### Phase 1 — global coverage
- automatic market discovery and validation
- larger market registry
- Samsung-specific product/spec extractors
- crawl rotation/incremental fetch
- validation reports

### Phase 2 — agent quality
- richer normalized specification schema
- lexical/full-text index
- cross-market product identity matching
- citations/snippet support optimized for agents

### Phase 3 — optional hosted service
- remote Streamable HTTP MCP
- cache/search service only if Git-backed querying becomes insufficient
- usage analytics and public API policy
