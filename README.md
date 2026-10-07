# S.com Data Platform

Open, text-first Samsung.com data for agents and developers.

S.com Data Platform discovers Samsung.com market inventories, selectively crawls product/commerce/support sources, normalizes them into agent-facing data marts, retains meaningful offer and commerce changes as history, and exposes the result through MCP.

## Why this exists

Samsung.com is global, fragmented by market, and difficult for agents to query consistently. This repository turns public site content into a reusable source-linked data layer without starting with paid infrastructure.

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
- `search_products`
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
