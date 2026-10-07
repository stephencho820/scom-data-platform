# Architecture

```text
Samsung.com markets
       |
       v
 robots.txt / sitemaps
       |
       v
 scripts/crawl.mjs
       |
       +--> data/current/{market}/pages.jsonl
       +--> data/current/{market}/products.jsonl
       +--> data/current/{market}/meta.json
       |
       +--> data/history/products/{market}.jsonl
                    |
          +---------+---------+
          |                   |
          v                   v
   src/mcp/server.mjs      GitHub Pages
   local stdio MCP         static public UI
```

## Why Git first?

Most captured content only needs the latest state. Git already provides:
- file storage
- versioned changes
- scheduled automation through Actions
- review/audit trail
- public distribution
- static hosting through Pages

A separate database is intentionally deferred until query volume or repository size proves it is needed.

## Data retention

- Page snapshots: latest successful snapshot only.
- Product current records: latest successful snapshot.
- Product history: append only when fingerprint changes.

## Scaling path

The interfaces are intentionally separated from storage. A later SQLite, DuckDB, object-store, or hosted search implementation can replace file reads without changing MCP tool semantics.
