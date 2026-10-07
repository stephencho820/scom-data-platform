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

async function martFor(market, name) {
  return readJsonl(path.join(ROOT, "data/marts", market, name + ".jsonl"));
}

async function productMasterFor(market) {
  return martFor(market, "product_master");
}

function textScore(values, terms) {
  const haystacks = values.map((value) => String(value || "").toLowerCase());
  let score = 0;
  for (const term of terms) {
    for (let index = 0; index < haystacks.length; index++) {
      if (haystacks[index].includes(term)) score += Math.max(1, 8 - index);
    }
  }
  return score;
}

async function searchProducts(query, market, limit = 8, audience, lifecycle) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const markets = market ? [market] : await availableMarketCodes();
  const results = [];

  for (const code of markets) {
    for (const product of await productMasterFor(code)) {
      if (audience && product.audience !== audience) continue;
      if (lifecycle && product.lifecycle_status !== lifecycle) continue;
      const relevance = textScore([
        product.name,
        product.sku,
        product.model,
        (product.category_path || []).join(" "),
        product.product_url
      ], terms);
      if (relevance > 0) results.push({ ...product, relevance });
    }
  }

  const lifecycleRank = { current_sellable: 0, current_unavailable: 1, unverified: 2, legacy: 3 };
  return results.sort((a, b) =>
    (lifecycleRank[a.lifecycle_status] ?? 9) - (lifecycleRank[b.lifecycle_status] ?? 9) ||
    b.relevance - a.relevance
  ).slice(0, limit);
}

async function findMartRow(market, mart, productKey) {
  return (await martFor(market, mart)).find((item) => item.market_product_key === productKey) || null;
}

async function joinedProduct(market, productKey) {
  const product = (await productMasterFor(market)).find((item) => item.market_product_key === productKey);
  if (!product) return null;

  const [specs, offer, commerce] = await Promise.all([
    findMartRow(market, "product_specs", productKey),
    findMartRow(market, "market_offers", productKey),
    findMartRow(market, "commerce_options", productKey)
  ]);

  if (product.lifecycle_status === "legacy") {
    return { product, specs, offer: null, commerce_options: null, commerce_note: "Legacy product: current price and commerce data are intentionally suppressed." };
  }
  if (product.lifecycle_status === "current_unavailable") {
    return { product, specs, offer, commerce_options: null, commerce_note: "Current catalog product is unavailable; price/promotions/commerce are intentionally suppressed." };
  }
  return { product, specs, offer, commerce_options: commerce };
}

function pageScore(record, terms) {
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

async function searchPages(query, market, limit) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const markets = market ? [market] : await availableMarketCodes();
  const results = [];

  for (const code of markets) {
    for (const page of await pagesFor(code)) {
      const relevance = pageScore(page, terms);
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

function asError(message) {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function buildServer() {
  const server = new McpServer({
    name: "scom-data-platform",
    version: "0.2.0"
  });

  server.registerTool(
    "list_markets",
    {
      description: "List configured Samsung.com markets, data-mart counts, and targeted crawl coverage.",
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
    "search_products",
    {
      description: "Search normalized Samsung product master records by product name, model, SKU, or category.",
      inputSchema: z.object({
        query: z.string().min(1),
        market: z.string().optional(),
        audience: z.enum(["consumer", "business", "unknown"]).optional(),
        lifecycle: z.enum(["current_sellable", "current_unavailable", "legacy", "unverified"]).optional(),
        limit: z.number().int().min(1).max(30).default(8)
      })
    },
    async ({ query, market, audience, lifecycle, limit }) =>
      asText(await searchProducts(query, market, limit, audience, lifecycle))
  );

  server.registerTool(
    "get_product",
    {
      description: "Get one normalized product with its specs, current market offer, and commerce options.",
      inputSchema: z.object({
        market: z.string().min(1),
        product_key: z.string().min(1)
      })
    },
    async ({ market, product_key }) => {
      const product = await joinedProduct(market, product_key);
      return product ? asText(product) : asError("Product not found in the local data marts.");
    }
  );

  server.registerTool(
    "get_product_specs",
    {
      description: "Get structured technical specification facts for a product. Empty specs mean the current source did not expose normalized structured specs yet.",
      inputSchema: z.object({
        market: z.string().min(1),
        product_key: z.string().min(1)
      })
    },
    async ({ market, product_key }) => {
      const row = await findMartRow(market, "product_specs", product_key);
      return row ? asText(row) : asError("Product specs not found.");
    }
  );

  server.registerTool(
    "get_market_offer",
    {
      description: "Get current price, currency, availability, purchase URL, and observed promotion evidence for a product in a market.",
      inputSchema: z.object({
        market: z.string().min(1),
        product_key: z.string().min(1)
      })
    },
    async ({ market, product_key }) => {
      const product = (await productMasterFor(market)).find((item) => item.market_product_key === product_key);
      if (!product) return asError("Product not found.");
      if (product.lifecycle_status === "legacy") return asError("Legacy product: current price/offer data is intentionally unavailable.");
      const row = await findMartRow(market, "market_offers", product_key);
      return row ? asText(row) : asError("Current market offer not found.");
    }
  );

  server.registerTool(
    "get_commerce_options",
    {
      description: "Get observed purchase methods, subscription, trade-in, Samsung Care+, delivery, installation, haul-away, bundle, and membership options for a product. Heuristic facts include source evidence.",
      inputSchema: z.object({
        market: z.string().min(1),
        product_key: z.string().min(1)
      })
    },
    async ({ market, product_key }) => {
      const product = (await productMasterFor(market)).find((item) => item.market_product_key === product_key);
      if (!product) return asError("Product not found.");
      if (product.lifecycle_status === "legacy" || product.lifecycle_status === "current_unavailable") {
        return asError("Commerce options are only exposed for currently sellable products.");
      }
      const row = await findMartRow(market, "commerce_options", product_key);
      return row ? asText(row) : asError("Commerce options not found.");
    }
  );

  server.registerTool(
    "compare_market_offers",
    {
      description: "Find the best product match for the same query in multiple markets and return each current offer and commerce options.",
      inputSchema: z.object({
        query: z.string().min(1),
        markets: z.array(z.string()).min(2).max(20)
      })
    },
    async ({ query, markets }) => {
      const comparison = {};
      for (const market of markets) {
        const candidates = await searchProducts(query, market, 8);
        const match = candidates.find((item) => item.lifecycle_status === "current_sellable" || item.lifecycle_status === "unverified") || candidates[0] || null;
        comparison[market] = match
          ? await joinedProduct(market, match.market_product_key)
          : null;
      }
      return asText(comparison);
    }
  );

  server.registerTool(
    "get_product_history",
    {
      description: "Return product identity, market-offer, and commerce-option history for a product key.",
      inputSchema: z.object({
        market: z.string().min(1),
        product_key: z.string().min(1)
      })
    },
    async ({ market, product_key }) => {
      const [productVersions, offerVersions, commerceVersions] = await Promise.all([
        readJsonl(path.join(ROOT, "data/history/products", market + ".jsonl")),
        readJsonl(path.join(ROOT, "data/history/offers", market + ".jsonl")),
        readJsonl(path.join(ROOT, "data/history/commerce_options", market + ".jsonl"))
      ]);

      const product = (await productMasterFor(market)).find((item) => item.market_product_key === product_key);
      const suppressCommerceHistory = product?.lifecycle_status === "legacy";
      return asText({
        market,
        product_key,
        lifecycle_status: product?.lifecycle_status || "unknown",
        product_versions: productVersions.filter((item) => item.key === product_key),
        offer_versions: suppressCommerceHistory ? [] : offerVersions.filter((item) => item.market_product_key === product_key),
        commerce_versions: suppressCommerceHistory ? [] : commerceVersions.filter((item) => item.market_product_key === product_key),
        note: suppressCommerceHistory ? "Legacy product: historical price/commerce is intentionally suppressed from the agent interface." : null
      });
    }
  );

  server.registerTool(
    "get_support_resources",
    {
      description: "Search normalized Samsung support/manual/download/warranty/repair resources in a market.",
      inputSchema: z.object({
        market: z.string().min(1),
        query: z.string().optional(),
        limit: z.number().int().min(1).max(30).default(10)
      })
    },
    async ({ market, query, limit }) => {
      let rows = await martFor(market, "support_resources");
      if (query) {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        rows = rows
          .map((row) => ({
            ...row,
            relevance: textScore([row.title, row.description, row.type, row.source_url], terms)
          }))
          .filter((row) => row.relevance > 0)
          .sort((a, b) => b.relevance - a.relevance);
      }
      return asText(rows.slice(0, limit));
    }
  );

  server.registerTool(
    "browse_category",
    {
      description: "Browse market-local taxonomy paths and products matching a category term.",
      inputSchema: z.object({
        market: z.string().min(1),
        category: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20)
      })
    },
    async ({ market, category, limit }) => {
      const term = category.toLowerCase();
      const [taxonomy, products] = await Promise.all([
        martFor(market, "taxonomy"),
        productMasterFor(market)
      ]);
      return asText({
        taxonomy: taxonomy.filter((row) => (row.path || []).join(" ").toLowerCase().includes(term)),
        products: products
          .filter((row) => (row.category_path || []).join(" ").toLowerCase().includes(term))
          .slice(0, limit)
      });
    }
  );

  server.registerTool(
    "search_scom",
    {
      description: "Fallback search over normalized source-page text. Prefer product data-mart tools for product, price, offer, or commerce questions.",
      inputSchema: z.object({
        query: z.string().min(1),
        market: z.string().optional(),
        limit: z.number().int().min(1).max(20).default(8)
      })
    },
    async ({ query, market, limit }) => asText(await searchPages(query, market, limit))
  );

  server.registerTool(
    "get_page",
    {
      description: "Diagnostic/fallback access to the normalized source-page record for an exact URL.",
      inputSchema: z.object({
        url: z.string().url(),
        market: z.string().optional()
      })
    },
    async ({ url, market }) => {
      const markets = market ? [market] : await availableMarketCodes();
      for (const code of markets) {
        const page = (await pagesFor(code)).find((item) =>
          item.url === url || item.canonical_url === url || item.discovered_url === url
        );
        if (page) return asText(page);
      }
      return asError("Page not found in the local dataset.");
    }
  );

  return server;
}

serveStdio(buildServer);
console.error("S.com Data Platform MCP server listening on stdio");
