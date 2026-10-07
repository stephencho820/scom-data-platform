import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const ROOT = process.cwd();

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function readJsonl(file) {
  try {
    return (await readFile(file, "utf8"))
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

async function registry() {
  return readJson(path.join(ROOT, "config/markets.json"), { markets: [] });
}

async function availableMarketCodes() {
  try {
    return await readdir(path.join(ROOT, "data/current"));
  } catch {
    return [];
  }
}

async function pagesFor(market) {
  return readJsonl(path.join(ROOT, "data/current", market, "pages.jsonl"));
}

function score(record, terms) {
  const title = (record.title || "").toLowerCase();
  const description = (record.description || "").toLowerCase();
  const text = (record.text || "").toLowerCase();
  let value = 0;
  for (const term of terms) {
    if (title.includes(term)) value += 8;
    if (description.includes(term)) value += 4;
    const first = text.indexOf(term);
    if (first >= 0) value += 1 + Math.max(0, 2 - Math.floor(first / 5000));
  }
  return value;
}

function snippet(text, terms, max = 700) {
  const lower = text.toLowerCase();
  let index = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found >= 0 && (index < 0 || found < index)) index = found;
  }
  if (index < 0) return text.slice(0, max);
  const start = Math.max(0, index - Math.floor(max / 3));
  return text.slice(start, start + max);
}

async function search(query, market, limit) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const markets = market ? [market] : await availableMarketCodes();
  const results = [];
  for (const code of markets) {
    for (const page of await pagesFor(code)) {
      const relevance = score(page, terms);
      if (relevance > 0) {
        results.push({
          market: code,
          title: page.title,
          url: page.canonical_url || page.url,
          description: page.description,
          snippet: snippet(page.text || "", terms),
          relevance
        });
      }
    }
  }
  return results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);
}

function asText(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function buildServer() {
  const server = new McpServer({
    name: "scom-data-platform",
    version: "0.1.0"
  });

  server.registerTool(
    "list_markets",
    {
      description: "List configured Samsung.com markets and the latest local crawl status.",
      inputSchema: z.object({})
    },
    async () => {
      const config = await registry();
      const rows = [];
      for (const item of config.markets) {
        const meta = await readJson(path.join(ROOT, "data/current", item.code, "meta.json"));
        rows.push({ ...item, crawl: meta });
      }
      return asText(rows);
    }
  );

  server.registerTool(
    "search_scom",
    {
      description: "Search normalized Samsung.com text across one market or all locally crawled markets. Results preserve source URLs.",
      inputSchema: z.object({
        query: z.string().min(1),
        market: z.string().optional(),
        limit: z.number().int().min(1).max(20).default(8)
      })
    },
    async ({ query, market, limit }) => asText(await search(query, market, limit))
  );

  server.registerTool(
    "get_page",
    {
      description: "Get the normalized Samsung.com page record for an exact source or canonical URL.",
      inputSchema: z.object({
        url: z.string().url(),
        market: z.string().optional()
      })
    },
    async ({ url, market }) => {
      const markets = market ? [market] : await availableMarketCodes();
      for (const code of markets) {
        const page = (await pagesFor(code)).find((item) => item.url === url || item.canonical_url === url);
        if (page) return asText(page);
      }
      return { isError: true, content: [{ type: "text", text: "Page not found in the local dataset." }] };
    }
  );

  server.registerTool(
    "compare_markets",
    {
      description: "Find the best Samsung.com match for the same query in multiple markets.",
      inputSchema: z.object({
        query: z.string().min(1),
        markets: z.array(z.string()).min(2).max(12)
      })
    },
    async ({ query, markets }) => {
      const comparison = {};
      for (const market of markets) comparison[market] = (await search(query, market, 3));
      return asText(comparison);
    }
  );

  server.registerTool(
    "get_product_history",
    {
      description: "Return retained versions for a product key in a market.",
      inputSchema: z.object({
        market: z.string().min(1),
        product_key: z.string().min(1)
      })
    },
    async ({ market, product_key }) => {
      const rows = await readJsonl(path.join(ROOT, "data/history/products", `${market}.jsonl`));
      return asText(rows.filter((item) => item.key === product_key));
    }
  );

  return server;
}

serveStdio(buildServer);
console.error("S.com Data Platform MCP server listening on stdio");
