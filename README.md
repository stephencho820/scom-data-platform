# S.com Data Platform

Open, text-first Samsung.com data for agents and developers.

S.com Data Platform discovers Samsung.com market inventories, selectively crawls product/commerce/support sources, normalizes them into SKU-first agent-facing data marts, retains meaningful offer and commerce changes as history, and exposes the result through MCP.

## Why this exists

Samsung.com is global, fragmented by market, and difficult for agents to query consistently. This repository turns public site content into a reusable source-linked data layer without starting with paid infrastructure.

## Product identity

The canonical product profile is a **SKU**, not a PDP URL or marketing product name. A single product family can therefore contain multiple SKU profiles for color, storage/capacity, size, region, or other sellable variants.

Hierarchy: `Market → Business Unit → Category → Product Family → Model → SKU`.

Business units are normalized to:

- `DA` — Digital Appliances
- `VD` — Visual Display
- `MX` — Mobile eXperience
- `HARMAN` — HARMAN portfolio
- `OTHER` — unresolved items that need taxonomy refinement

SKU master keys are deterministic from `market + SKU`. Pages without a concrete SKU remain available as source evidence/history but are not emitted as canonical SKU profiles.

## v0 architecture

- **Storage:** Git repository
- **Scheduler:** GitHub Actions
- **Public site:** GitHub Pages
- **Crawler:** Node.js sitemap/robots crawler
- **Current data:** `data/current/{market}`
- **Product history:** `data/history/products`
- **Agent interface:** local stdio MCP
- **Images:** not stored

See [PRD](./docs/PRD.md), [Data Marts](./docs/DATA_MART.md), and [Architecture](./docs/ARCHITECTURE.md).

## Quick start

```bash
git clone https://github.com/stephencho820/scom-data-platform.git
cd scom-data-platform
npm install
```

Run one market crawl:

```bash
npm run crawl -- --market=us --batch=30
```

Run the MCP server:

```bash
npm run mcp
```

The MCP is data-mart first. Primary tools include:

- `list_markets`
- `search_products` (supports `business_unit` filter)
- `list_skus`
- `get_product`
- `get_product_specs`
- `get_market_offer`
- `get_commerce_options`
- `compare_market_offers`
- `get_product_history`
- `get_support_resources`
- `browse_category`

`search_scom` and `get_page` remain as source-evidence fallbacks.

## Data policy

Most pages are overwrite-first: the latest successful crawl replaces the previous current snapshot.

Product records are different. When a normalized product fingerprint changes, the new version is appended to product history. This keeps useful specification/offer change history without versioning every page forever.

Every normalized record keeps its Samsung.com source URL.

## Current status

This is the repository MVP. The first configured seed markets are:

- United States — `/us/`
- United Kingdom — `/uk/`
- Korea — `/sec/`

The architecture is designed so the market registry can expand without changing MCP tool semantics.

## Cost model

The v0 target is effectively **$0 recurring infrastructure cost** for this public project by using GitHub repository storage, GitHub Actions, GitHub Pages, and local MCP execution.

## Disclaimer

This is an independent community data project and is not an official Samsung service. Crawling should respect applicable robots directives, site terms, rate limits, and source attribution.


## Korea product universe scope

The KR chatbot catalog treats SKU as the canonical product index and separates discovery evidence from lifecycle state.

- `current_sellable`: present in the current Samsung.com KR catalog and directly purchasable.
- `current_out_of_stock`: current catalog SKU with a buy path but no current stock.
- `current_not_directly_sellable`: current catalog SKU that is visible but not directly purchasable online.
- `discontinued`: previously known SKU absent from a successfully verified current catalog.
- `legacy_supported`: historical SKU/model with current Samsung Support/manual evidence.
- `legacy_archived`: historical SKU retained for chatbot/product-history lookup when live support evidence is no longer available.
- `unverified`: evidence is insufficient to assign a stronger lifecycle state.

Target history windows are approximately 10 years for MX/VD and 15 years for DA. These are coverage goals, not reasons to fabricate dates: legacy records require Samsung-owned evidence and preserve source URLs/capture timestamps.

Current-catalog completeness is measured separately from legacy coverage. A category is not considered complete merely because the crawler returned some SKUs.


## Immutable SKU registry

Product identity and hardware specifications are treated as immutable after first capture.

- Current catalog discovery continues on recurring crawls to find new SKUs.
- A newly discovered SKU is deep-enriched once and persisted in `data/marts/{market}/sku_registry.jsonl`.
- Known SKUs reuse their stored profile/specs instead of repeating deep specification extraction.
- Price, stock, sellability, promotions, commerce options, and lifecycle remain dynamic and can be refreshed repeatedly.
- SKUs are retained in the registry when they leave the current catalog; lifecycle/support pipelines can subsequently classify them as discontinued or legacy.
- Historical/legacy backfill uses the same registry so a SKU has one durable identity across current and historical sources.
