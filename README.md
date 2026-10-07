# S.com Data Platform

Open, text-first Samsung.com data for agents and developers.

S.com Data Platform discovers public Samsung.com pages market by market, normalizes them into compact JSONL records, keeps the latest snapshot for most content, retains meaningful product changes as history, and exposes the result through MCP.

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

See [PRD](./docs/PRD.md) and [Architecture](./docs/ARCHITECTURE.md).

## Quick start

```bash
git clone https://github.com/stephencho820/scom-data-platform.git
cd scom-data-platform
npm install
```

Run one market crawl:

```bash
npm run crawl -- --market=us --max=30
```

Run the MCP server:

```bash
npm run mcp
```

The MCP currently exposes:

- `list_markets`
- `search_scom`
- `get_page`
- `compare_markets`
- `get_product_history`

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
