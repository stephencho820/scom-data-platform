# Architecture

```text
Samsung.com robots.txt + sitemaps
              |
              v
      Full URL inventory
      data/manifests/{market}.json
              |
              v
      Data-mart URL scope
      config/crawl-scope.json
              |
              v
      Incremental target crawl
      scripts/crawl.mjs
              |
       +------+------------------+
       |                         |
       v                         v
raw normalized evidence      normalized marts
data/current/{market}        data/marts/{market}
       |                         |
       |                  +------+------+---------+
       |                  |      |      |         |
       |               Product Specs  Offer   Commerce
       |                                      Support/Taxonomy
       |                         |
       +-------------------------+
                                 v
                     meaningful-change history
                     data/history/*
                                 |
                     +-----------+-----------+
                     |                       |
                     v                       v
              src/mcp/server.mjs       GitHub Pages
              mart-first MCP           public explorer
```

## Discovery is not collection

The sitemap inventory can contain tens of thousands of URLs. Keeping that inventory is useful for coverage and classification, but it does not mean every URL should be fetched.

`config/crawl-scope.json` selects URLs likely to populate an agent-facing data mart.

## Data-mart-first querying

MCP tools read normalized marts first. Raw page text remains as evidence, diagnostics, and fallback search.

## History

History is retained for:
- product identity changes
- price / availability / promotions
- purchase and subscription options
- trade-in and protection
- delivery / installation / haul-away
- future normalized specs

Full page text history is intentionally not retained.

## Scaling path

Git/JSONL is the initial storage layer. If size or query latency becomes a problem, mart files can move to SQLite, DuckDB, object storage, or a search service while preserving the same MCP contracts.
