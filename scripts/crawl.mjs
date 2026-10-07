import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const ROOT = process.cwd();
const USER_AGENT = "ScomDataPlatform/0.2 (+https://github.com/stephencho820/scom-data-platform)";
const DEFAULT_BATCH = 120;
const DEFAULT_DELAY = 500;
const MAX_TEXT_CHARS = 50000;
const REQUEST_TIMEOUT = 20000;

function arg(name, fallback) {
  const prefix = "--" + name + "=";
  const item = process.argv.find((value) => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : fallback;
}

const marketCode = arg("market", "us");
const batchPages = Number(arg("batch", DEFAULT_BATCH));
const delayMs = Number(arg("delay", DEFAULT_DELAY));
const explicitUrl = arg("url", "");
const discoverOnly = process.argv.includes("--discover-only") || batchPages === 0;

const registry = JSON.parse(await readFile(path.join(ROOT, "config/markets.json"), "utf8"));
const market = registry.markets.find((item) => item.code === marketCode);
if (!market) throw new Error("Unknown market: " + marketCode);

const base = new URL(market.baseUrl);
const marketPrefix = base.pathname.endsWith("/") ? base.pathname : base.pathname + "/";
const capturedAt = new Date().toISOString();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const decode = (value = "") =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function readJsonl(file) {
  try {
    const text = await readFile(file, "utf8");
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

const toJsonl = (rows) => rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(response.status + " " + response.statusText);

    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());
    let body = buffer;
    if (/gzip/i.test(contentType) || url.toLowerCase().endsWith(".gz")) {
      try {
        body = gunzipSync(buffer);
      } catch {
        body = buffer;
      }
    }

    return { text: body.toString("utf8"), finalUrl: response.url, contentType };
  } finally {
    clearTimeout(timer);
  }
}

function parseRobots(text) {
  const sitemaps = [];
  const groups = [];
  let agents = [];
  let disallow = [];
  let allow = [];
  let directivesStarted = false;

  const flush = () => {
    if (agents.length) groups.push({ agents, disallow, allow });
    agents = [];
    disallow = [];
    allow = [];
    directivesStarted = false;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const [keyRaw, ...rest] = line.split(":");
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "sitemap" && value) {
      sitemaps.push(value);
      continue;
    }

    if (key === "user-agent") {
      if (directivesStarted) flush();
      if (value) agents.push(value.toLowerCase());
      continue;
    }

    if ((key === "disallow" || key === "allow") && agents.length) {
      directivesStarted = true;
      if (!value) continue;
      if (key === "disallow") disallow.push(value);
      if (key === "allow") allow.push(value);
    }
  }

  flush();
  const wildcard = groups.find((group) => group.agents.includes("*")) || { disallow: [], allow: [] };
  return { sitemaps, disallow: wildcard.disallow, allow: wildcard.allow };
}

function robotPatternMatches(url, pattern) {
  const parsed = new URL(url);
  const target = parsed.pathname + parsed.search;
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  let escaped = "";

  for (const char of body) {
    if (char === "*") escaped += ".*";
    else if ("\\^$+?.()|{}[]".includes(char)) escaped += "\\" + char;
    else escaped += char;
  }

  return new RegExp("^" + escaped + (anchored ? "$" : "")).test(target);
}

function allowedByRobots(url, rules) {
  const matches = [];
  for (const pattern of rules.disallow || []) {
    if (robotPatternMatches(url, pattern)) matches.push({ type: "disallow", length: pattern.replace(/\*/g, "").length });
  }
  for (const pattern of rules.allow || []) {
    if (robotPatternMatches(url, pattern)) matches.push({ type: "allow", length: pattern.replace(/\*/g, "").length });
  }
  if (!matches.length) return true;
  matches.sort((a, b) => b.length - a.length || (a.type === "allow" ? -1 : 1));
  return matches[0].type === "allow";
}

function xmlLocs(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => {
    const raw = match[1].trim().replace(/^<!\[CDATA\[/i, "").replace(/\]\]>$/i, "").trim();
    return decode(raw);
  });
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

async function discoverUrls(sitemapSeeds) {
  let frontier = [...new Set(sitemapSeeds)];
  const seenMaps = new Set();
  const urls = new Set();
  const failedSitemaps = [];
  const concurrency = 8;

  while (frontier.length) {
    const current = frontier.filter((url) => url && !seenMaps.has(url));
    frontier = [];
    for (const url of current) seenMaps.add(url);
    if (!current.length) continue;

    const results = await mapLimit(current, concurrency, async (sitemapUrl) => {
      try {
        const { text } = await fetchText(sitemapUrl);
        return {
          sitemapUrl,
          locs: xmlLocs(text),
          isIndex: /<sitemapindex[\s>]/i.test(text)
        };
      } catch (error) {
        failedSitemaps.push({ url: sitemapUrl, error: error.message });
        console.error("sitemap failed: " + sitemapUrl + ": " + error.message);
        return null;
      }
    });

    for (const result of results.filter(Boolean)) {
      if (result.isIndex) {
        for (const loc of result.locs) {
          try {
            const candidate = new URL(loc);
            if (candidate.origin === base.origin && !seenMaps.has(candidate.href)) frontier.push(candidate.href);
          } catch {}
        }
      } else {
        for (const loc of result.locs) {
          try {
            const candidate = new URL(loc);
            if (candidate.origin === base.origin && candidate.pathname.startsWith(marketPrefix)) urls.add(candidate.href);
          } catch {}
        }
      }
    }

    frontier = [...new Set(frontier)];
  }

  return { urls: [...urls], sitemapCount: seenMaps.size, failedSitemaps };
}

function tagAttr(html, tagName, attrName, expected) {
  const tags = html.match(new RegExp("<" + tagName + "\\b[^>]*>", "gi")) || [];
  for (const tag of tags) {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
        .map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? ""])
    );
    const actual = (attrs[attrName] || "").toLowerCase();
    if (!expected || actual.split(/\s+/).includes(expected.toLowerCase())) return attrs;
  }
  return null;
}

function visibleText(html) {
  return decode(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<img\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}

function findProductObjects(value, out = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) findProductObjects(item, out);
    return out;
  }
  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((item) => String(item).toLowerCase() === "product")) out.push(value);
  for (const child of Object.values(value)) findProductObjects(child, out);
  return out;
}

function parseProducts(html, pageUrl) {
  const products = [];
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim());
      for (const product of findProductObjects(parsed)) {
        const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
        const name = String(product.name || "").trim();
        const sku = String(product.sku || product.mpn || "").trim();
        const model = String(product.model || product.productID || "").trim();
        const keySeed = sku || model || name || pageUrl;
        const normalized = {
          key: sha(marketCode + "|" + keySeed.toLowerCase()).slice(0, 24),
          market: marketCode,
          url: pageUrl,
          name,
          sku,
          model,
          brand: typeof product.brand === "string" ? product.brand : (product.brand?.name || "Samsung"),
          offers: offers ? {
            price: offers.price ?? offers.lowPrice ?? "",
            currency: offers.priceCurrency ?? "",
            availability: offers.availability ?? ""
          } : null,
          captured_at: capturedAt
        };

        normalized.fingerprint = sha(JSON.stringify({
          name: normalized.name,
          sku: normalized.sku,
          model: normalized.model,
          brand: normalized.brand,
          offers: normalized.offers
        }));

        products.push(normalized);
      }
    } catch {}
  }
  return products;
}

function extractPage(html, finalUrl, discoveredUrl) {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const metaDescription = (tagAttr(html, "meta", "name", "description") || {}).content || "";
  const canonicalAttrs = tagAttr(html, "link", "rel", "canonical");
  const canonical = canonicalAttrs?.href ? new URL(canonicalAttrs.href, finalUrl).href : finalUrl;
  const text = visibleText(html);

  const record = {
    id: sha(canonical).slice(0, 24),
    market: marketCode,
    discovered_url: discoveredUrl,
    url: finalUrl,
    canonical_url: canonical,
    title,
    description: decode(metaDescription),
    text,
    captured_at: capturedAt
  };

  record.content_hash = sha(JSON.stringify({
    canonical_url: record.canonical_url,
    title: record.title,
    description: record.description,
    text: record.text
  }));
  return record;
}

function priority(url) {
  const value = url.toLowerCase();
  let score = 0;
  if (/\/smartphones?\//.test(value)) score += 5;
  if (/\/tablets?\//.test(value)) score += 5;
  if (/\/tvs?\//.test(value)) score += 5;
  if (/\/monitors?\//.test(value)) score += 4;
  if (/\/refrigerators?\//.test(value)) score += 4;
  if (/\/washers?|\/washing-machines?\//.test(value)) score += 4;
  if (/\/support\//.test(value)) score += 2;
  if (/\/buy\//.test(value)) score += 4;
  return -score;
}

function chooseBatch(urls, existingPages, previousCursor, requestedBatch) {
  if (!urls.length || requestedBatch <= 0) return { selected: [], nextCursor: previousCursor || 0, wrapped: false };

  const size = Math.min(requestedBatch, urls.length);
  const known = new Set();
  for (const page of existingPages) {
    for (const candidate of [page.discovered_url, page.url, page.canonical_url]) if (candidate) known.add(candidate);
  }

  const selected = [];
  const chosen = new Set();
  for (const url of urls) {
    if (!known.has(url)) {
      selected.push(url);
      chosen.add(url);
      if (selected.length >= size) return { selected, nextCursor: previousCursor || 0, wrapped: false };
    }
  }

  const cursor = Math.max(0, Number(previousCursor || 0)) % urls.length;
  let scanned = 0;
  while (selected.length < size && scanned < urls.length) {
    const candidate = urls[(cursor + scanned) % urls.length];
    if (!chosen.has(candidate)) {
      selected.push(candidate);
      chosen.add(candidate);
    }
    scanned += 1;
  }

  return { selected, nextCursor: (cursor + scanned) % urls.length, wrapped: cursor + scanned >= urls.length };
}

const currentDir = path.join(ROOT, "data/current", marketCode);
const historyDir = path.join(ROOT, "data/history/products");
const manifestDir = path.join(ROOT, "data/manifests");
const manifestFile = path.join(manifestDir, marketCode + ".json");
const metaFile = path.join(currentDir, "meta.json");

await mkdir(currentDir, { recursive: true });
await mkdir(historyDir, { recursive: true });
await mkdir(manifestDir, { recursive: true });

const existingPages = await readJsonl(path.join(currentDir, "pages.jsonl"));
const existingProducts = await readJsonl(path.join(currentDir, "products.jsonl"));
const existingMeta = await readJson(metaFile, {});
const previousManifest = await readJson(manifestFile, { cursor: 0, cycle: 0 });

const robotsUrl = new URL("/robots.txt", base).href;
let robots = { sitemaps: [], disallow: [], allow: [] };
try {
  robots = parseRobots((await fetchText(robotsUrl)).text);
} catch (error) {
  console.error("robots unavailable: " + error.message);
}

const marketSitemaps = robots.sitemaps.filter((value) => {
  try {
    const candidate = new URL(value);
    return candidate.origin === base.origin && candidate.pathname.startsWith(marketPrefix);
  } catch {
    return false;
  }
});

const preferredSitemap = new URL("sitemap.xml", base).href;
const seeds = [...new Set(marketSitemaps.length ? [...marketSitemaps, preferredSitemap] : [preferredSitemap])];

console.error("discovering sitemap inventory for " + marketCode + "...");
const discovery = await discoverUrls(seeds);
const discoveredUrls = discovery.urls
  .filter((url) => {
    try {
      const candidate = new URL(url);
      return candidate.origin === base.origin && candidate.pathname.startsWith(marketPrefix);
    } catch {
      return false;
    }
  })
  .sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));

const crawlableUrls = discoveredUrls.filter((url) => allowedByRobots(url, robots));
if (!crawlableUrls.length && !explicitUrl) throw new Error("No crawlable URLs discovered for " + marketCode);

const urlHash = sha(crawlableUrls.join("\n"));
const cursorBase = previousManifest.url_hash === urlHash
  ? Number(previousManifest.cursor || 0)
  : Math.min(Number(previousManifest.cursor || 0), Math.max(crawlableUrls.length - 1, 0));

let cycle = Number(previousManifest.cycle || 0);
let selected = [];
let nextCursor = cursorBase;
let wrapped = false;

if (explicitUrl) {
  selected = [explicitUrl];
} else if (!discoverOnly) {
  const batch = chooseBatch(crawlableUrls, existingPages, cursorBase, batchPages);
  selected = batch.selected;
  nextCursor = batch.nextCursor;
  wrapped = batch.wrapped;
  if (wrapped) cycle += 1;
}

const manifest = {
  version: 2,
  market: marketCode,
  base_url: market.baseUrl,
  discovered_at: capturedAt,
  sitemap_seed_count: seeds.length,
  sitemap_count: discovery.sitemapCount,
  failed_sitemaps: discovery.failedSitemaps,
  discovered_urls_total: discoveredUrls.length,
  crawlable_urls_total: crawlableUrls.length,
  url_hash: urlHash,
  cursor: nextCursor,
  cycle,
  urls: crawlableUrls
};

await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

if (discoverOnly) {
  const coveredSet = new Set();
  const crawlableSet = new Set(crawlableUrls);
  for (const page of existingPages) {
    for (const candidate of [page.discovered_url, page.url, page.canonical_url]) {
      if (candidate && crawlableSet.has(candidate)) coveredSet.add(candidate);
    }
  }

  const coveragePercent = crawlableUrls.length ? Math.round((coveredSet.size / crawlableUrls.length) * 10000) / 100 : 0;

  await writeFile(metaFile, JSON.stringify({
    ...existingMeta,
    market: marketCode,
    base_url: market.baseUrl,
    inventory_updated_at: capturedAt,
    sitemap_count: discovery.sitemapCount,
    failed_sitemaps: discovery.failedSitemaps.length,
    discovered_urls_total: discoveredUrls.length,
    crawlable_urls_total: crawlableUrls.length,
    coverage_pages: coveredSet.size,
    coverage_percent: coveragePercent,
    crawl_cursor: nextCursor,
    crawl_cycle: cycle
  }, null, 2) + "\n");

  console.error("inventory: " + marketCode + ": " + crawlableUrls.length + " crawlable URLs across " + discovery.sitemapCount + " sitemaps");
  process.exit(0);
}

if (!selected.length) throw new Error("No URLs selected for crawl for " + marketCode);

console.error("inventory: " + marketCode + ": " + crawlableUrls.length + " crawlable URLs; crawling batch of " + selected.length);

const crawledPages = [];
const crawledProducts = new Map();
let failures = 0;

for (let index = 0; index < selected.length; index++) {
  const discoveredUrl = selected[index];
  try {
    const { text: html, finalUrl, contentType } = await fetchText(discoveredUrl);
    if (!/html/i.test(contentType) && !/<html[\s>]/i.test(html)) continue;
    const page = extractPage(html, finalUrl, discoveredUrl);
    if (page.text) crawledPages.push(page);
    for (const product of parseProducts(html, page.canonical_url)) crawledProducts.set(product.key, product);
    console.error("[" + (index + 1) + "/" + selected.length + "] ok " + discoveredUrl);
  } catch (error) {
    failures += 1;
    console.error("[" + (index + 1) + "/" + selected.length + "] failed " + discoveredUrl + ": " + error.message);
  }
  if (delayMs > 0 && index < selected.length - 1) await sleep(delayMs);
}

if (!crawledPages.length) throw new Error("Crawl produced zero pages for " + marketCode + "; previous data left untouched");

const pageMap = new Map();
for (const page of existingPages) {
  const key = page.id || sha(page.canonical_url || page.url || JSON.stringify(page)).slice(0, 24);
  pageMap.set(key, page);
}
for (const page of crawledPages) pageMap.set(page.id, page);

const productMap = new Map(existingProducts.map((product) => [product.key, product]));
for (const product of crawledProducts.values()) productMap.set(product.key, product);

const historyFile = path.join(historyDir, marketCode + ".jsonl");
const history = await readJsonl(historyFile);
const latestFingerprint = new Map();
for (const item of history) latestFingerprint.set(item.key, item.fingerprint);
for (const product of crawledProducts.values()) {
  if (latestFingerprint.get(product.key) !== product.fingerprint) {
    history.push(product);
    latestFingerprint.set(product.key, product.fingerprint);
  }
}

const allPages = [...pageMap.values()].sort((a, b) => String(a.canonical_url || a.url || "").localeCompare(String(b.canonical_url || b.url || "")));
const allProducts = [...productMap.values()].sort((a, b) => String(a.name || a.model || a.sku || "").localeCompare(String(b.name || b.model || b.sku || "")));

const crawlableSet = new Set(crawlableUrls);
const coveredSet = new Set();
for (const page of allPages) {
  for (const candidate of [page.discovered_url, page.url, page.canonical_url]) {
    if (candidate && crawlableSet.has(candidate)) coveredSet.add(candidate);
  }
}

const coveragePercent = crawlableUrls.length ? Math.round((coveredSet.size / crawlableUrls.length) * 10000) / 100 : 0;

await writeFile(path.join(currentDir, "pages.jsonl"), toJsonl(allPages));
await writeFile(path.join(currentDir, "products.jsonl"), toJsonl(allProducts));
await writeFile(historyFile, toJsonl(history));
await writeFile(metaFile, JSON.stringify({
  market: marketCode,
  base_url: market.baseUrl,
  captured_at: capturedAt,
  inventory_updated_at: capturedAt,
  sitemap_count: discovery.sitemapCount,
  failed_sitemaps: discovery.failedSitemaps.length,
  discovered_urls_total: discoveredUrls.length,
  crawlable_urls_total: crawlableUrls.length,
  crawl_cursor: nextCursor,
  crawl_cycle: cycle,
  batch_requested: selected.length,
  batch_success: crawledPages.length,
  failures,
  coverage_pages: coveredSet.size,
  coverage_percent: coveragePercent,
  pages_written: allPages.length,
  products_written: allProducts.length,
  history_versions: history.length
}, null, 2) + "\n");

console.error("done: " + marketCode + ": " + crawledPages.length + "/" + selected.length + " batch pages ok; " + allPages.length + " total pages stored; " + coveredSet.size + "/" + crawlableUrls.length + " sitemap coverage (" + coveragePercent + "%); " + allProducts.length + " products; " + failures + " failures");
