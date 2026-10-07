# MCP usage

The repository exposes its local dataset as a stdio MCP server.

## Requirements

- Node.js 20+
- `npm install`

## Start manually

```bash
npm run mcp
```

The process intentionally writes protocol traffic only to stdout. Human-readable startup logging goes to stderr.

## Generic MCP host configuration

Replace `/absolute/path/scom-data-platform` with your clone path.

```json
{
  "mcpServers": {
    "scom": {
      "command": "node",
      "args": ["/absolute/path/scom-data-platform/src/mcp/server.mjs"],
      "cwd": "/absolute/path/scom-data-platform"
    }
  }
}
```

## Tools

### list_markets
Returns configured markets plus local crawl metadata when available.

### search_scom
Searches normalized page text. Inputs:
- `query`
- optional `market`
- optional `limit`

### get_page
Returns a normalized page for an exact Samsung.com URL.

### compare_markets
Runs the same query across multiple market datasets.

### get_product_history
Returns retained versions for a product key in a market.

## Hosted MCP later

The repository starts with stdio because it is free, private-by-default on the user's machine, and requires no always-on server. A future remote Streamable HTTP endpoint can reuse the same query layer when public hosted access is needed.
