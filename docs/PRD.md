# S.com Data Platform — Product Requirements Document

## Product vision

S.com Data Platform is an open, text-first, agent-native data layer for Samsung.com.

It is not intended to mirror every Samsung.com page. The platform discovers the full public sitemap inventory, then selectively crawls pages that can populate high-value data marts for product, commerce, support, and cross-market questions.

## Core principles

1. Text first; no image mirroring in the core dataset.
2. Data-mart first; crawl pages because they populate an agent use case, not merely because a URL exists.
3. Current by default; retain history only for decision-relevant facts.
4. Market aware; every fact carries market and source provenance.
5. Evidence preserving; heuristic commerce extraction keeps a source snippet.
6. Agent native; MCP tools query normalized marts before raw page text.
7. Zero-cost first; GitHub repository, Actions, Pages, and local stdio MCP.
8. Respectful crawling; honor robots rules and bounded request rates.

## Primary agent use cases

- Find a Samsung product by name, model, SKU, or category.
- Compare a product across markets.
- Compare current price and availability.
- Ask how a product can be purchased: outright, financing, installments, subscription, rental, or upgrade programs.
- Ask whether trade-in, Samsung Care+, delivery, installation, recycling, or haul-away is available.
- Inspect promotions and bundle/add-on evidence.
- Compare technical specs.
- Retrieve product support/manual/download/warranty resources.
- Track price, offer, commerce-option, and important product changes over time.

## Data marts

The canonical agent-facing marts are defined in [DATA_MART.md](./DATA_MART.md).

Current marts:
- Product Master
- Product Specs
- Market Offer
- Commerce Options
- Support Resources
- Taxonomy
- History for product identity, offer, and commerce changes

## Storage model

```text
data/
  manifests/
    {market}.json
  current/
    {market}/
      pages.jsonl
      products.jsonl
      meta.json
  marts/
    {market}/
      product_master.jsonl
      product_specs.jsonl
      market_offers.jsonl
      commerce_options.jsonl
      support_resources.jsonl
      taxonomy.jsonl
  history/
    products/{market}.jsonl
    offers/{market}.jsonl
    commerce_options/{market}.jsonl
```

The full sitemap inventory is discovery metadata. Only URLs matching the configured mart scope become crawl candidates.

## Crawl strategy

1. Read robots.txt and all relevant sitemap indexes.
2. Build the complete market URL inventory.
3. Apply `config/crawl-scope.json` to select product, buy, support, and commerce/service candidates.
4. Prioritize PDP/buy and service-relevant URLs.
5. Crawl incremental batches, preferring unvisited target URLs.
6. Merge normalized source records instead of replacing the whole dataset with one batch.
7. Rebuild current marts from normalized records.
8. Append history only when normalized fingerprints change.

## Extraction strategy

Structured sources are preferred:
- JSON-LD Product identity
- price, currency, availability
- structured Product additionalProperty specs when exposed

Commerce options may also be detected from normalized visible text. These heuristic observations always preserve an evidence snippet and source URL.

Absence of evidence is represented as no observation, not as a definitive `false`.

## MCP interface

Primary:
- `list_markets`
- `search_products`
- `get_product`
- `get_product_specs`
- `get_market_offer`
- `get_commerce_options`
- `compare_market_offers`
- `get_product_history`
- `get_support_resources`
- `browse_category`

Fallback/diagnostic:
- `search_scom`
- `get_page`

## Non-functional requirements

- Every normalized fact preserves source URL and capture time.
- Failed crawl batches must not erase previous successful data.
- History is limited to meaningful changes rather than full page snapshots.
- The design must remain usable without a paid database while dataset size permits.
- Storage can later move to SQLite/DuckDB/object storage without changing MCP semantics.

## Delivery phases

### Phase 0
Repository, crawl engine, Git-backed storage, Pages, stdio MCP.

### Phase 1 — Data marts
Targeted crawl scope, normalized product/offer/commerce/support marts, evidence, and mart-first MCP.

### Phase 2 — Product intelligence
Samsung-specific spec extraction, stronger product identity matching across countries, variant modeling, offer normalization, and market comparison quality.

### Phase 3 — Scale
Automatic market discovery, prioritized refresh schedules, change-aware sitemap processing, sharding/indexing as required.

### Phase 4 — Optional hosted access
Remote Streamable HTTP MCP and public usage controls if hosted demand justifies it.
