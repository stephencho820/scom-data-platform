import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const USER_AGENT = "ScomDataPlatform/0.1 (+https://github.com/stephencho820/scom-data-platform)";
const DEFAULT_MAX = 80;
const DEFAULT_DELAY = 700;
const MAX_TEXT_CHARS = 50000;
const REQUEST_TIMEOUT = 20000;

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const item = process.argv.find((value) => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : fallback;
}

const marketCode = arg("market", "us");
const maxPages = Number(arg("max", DEFAULT_MAX));
const delayMs = Number(arg("delay", DEFAULT_DELAY));
const explicitUrl = arg("url", "");

const registry = JSON.parse(await readFile(path.join(ROOT, "config/markets.json"), "utf8"));
const market = registry.markets.find((item) => item.code === marketCode);
if (!market) throw new Error(`Unknown market: ${marketCode}`);

const base = new URL(market.baseUrl);
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
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return { text: await response.text(), finalUrl: response.url, contentType: response.headers.get("content-type") || "" };
  } finally {
    clearTimeout(timer);
  }
}

function parseRobots(text) {
  const sitemaps = [];
  const disallow = [];
  let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const [keyRaw, ...rest] = line.split(":");
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") applies = value === "*";
    if (key === "sitemap" && value) sitemaps.push(value);
    if (applies && key === "disallow" && value) disallow.push(value);
  }
  return { sitemaps, disallow };
}

function allowedByRobots(url, rules) {
  const pathname = new URL(url).pathname;
  return !rules.disallow.some((prefix) => prefix !== "/" && pathname.startsWith(prefix));
}

function xmlLocs(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => decode(m[1].trim()));
}

async function discoverUrls(sitemapSeeds, maxWanted) {
  const queue = [...new Set(sitemapSeeds)];
  const seenMaps = new Set();
  const urls = new Set();

  while (queue.length && urls.size < maxWanted) {
    const sitemapUrl = queue.shift();
    if (seenMaps.has(sitemapUrl) || seenMaps.size >= 40) continue;
    seenMaps.add(sitemapUrl);

    try {
      const { text } = await fetchText(sitemapUrl);
      const locs = xmlLocs(text);
      const isIndex = /<sitemapindex[\s>]/i.test(text);
      if (isIndex) {
        for (const loc of locs) {
          if (queue.length < 80) queue.push(loc);
        }
      } else {
        for (const loc of locs) {
          try {
            const u = new URL(loc);
            if (u.origin === base.origin) urls.add(u.href);
          } catch {}
          if (urls.size >= maxWanted) break;
        }
      }
    } catch (error) {
      console.error(`sitemap failed: ${sitemapUrl}: ${error.message}`);
    }
  }

  return [...urls];
}

function tagAttr(html, tagName, attrName, expected) {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) || [];
  for (const tag of tags) {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
        .map((m) => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? ""])
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
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
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
      for (const p of findProductObjects(parsed)) {
        const offers = Array.isArray(p.offers) ? p.offers[0] : p.offers;
        const name = String(p.name || "").trim();
        const sku = String(p.sku || p.mpn || "").trim();
        const model = String(p.model || p.productID || "").trim();
        const keySeed = sku || model || name || pageUrl;
        const normalized = {
          key: sha(`${marketCode}|${keySeed.toLowerCase()}`).slice(0, 24),
          market: marketCode,
          url: pageUrl,
          name,
          sku,
          model,
          brand: typeof p.brand === "string" ? p.brand : (p.brand?.name || "Samsung"),
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

function extractPage(html, url) {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const metaDescription = (tagAttr(html, "meta", "name", "description") || {}).content || "";
  const canonicalAttrs = tagAttr(html, "link", "rel", "canonical");
  const canonical = canonicalAttrs?.href ? new URL(canonicalAttrs.href, url).href : url;
  const text = visibleText(html);
  const record = {
    id: sha(canonical).slice(0, 24),
    market: marketCode,
    url,
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
  const u = url.toLowerCase();
  let score = 0;
  if (/\/smartphones?\//.test(u)) score += 5;
  if (/\/tablets?\//.test(u)) score += 5;
  if (/\/tvs?\//.test(u)) score += 5;
  if (/\/monitors?\//.test(u)) score += 4;
  if (/\/refrigerators?\//.test(u)) score += 4;
  if (/\/washers?|\/washing-machines?\//.test(u)) score += 4;
  if (/\/support\//.test(u)) score += 2;
  if (/\/buy\//.test(u)) score += 4;
  return -score;
}

async function readJsonl(file) {
  try {
    const text = await readFile(file, "utf8");
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

const robotsUrl = new URL("/robots.txt", base).href;
let robots = { sitemaps: [], disallow: [] };
try {
  robots = parseRobots((await fetchText(robotsUrl)).text);
} catch (error) {
  console.error(`robots unavailable: ${error.message}`);
}

const seeds = robots.sitemaps.length ? robots.sitemaps : [new URL("/sitemap.xml", base).href];
let urls = explicitUrl ? [explicitUrl] : await discoverUrls(seeds, Math.max(maxPages * 8, maxPages));
urls = urls
  .filter((url) => {
    try {
      return new URL(url).origin === base.origin && allowedByRobots(url, robots);
    } catch {
      return false;
    }
  })
  .sort((a, b) => priority(a) - priority(b))
  .slice(0, maxPages);

if (!urls.length) throw new Error(`No crawlable URLs discovered for ${marketCode}`);

const pages = [];
const productMap = new Map();
let failures = 0;

for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  try {
    const { text: html, finalUrl, contentType } = await fetchText(url);
    if (!/html/i.test(contentType) && !/<html[\s>]/i.test(html)) continue;
    const page = extractPage(html, finalUrl);
    if (page.text) pages.push(page);
    for (const product of parseProducts(html, page.canonical_url)) productMap.set(product.key, product);
    console.error(`[${i + 1}/${urls.length}] ok ${url}`);
  } catch (error) {
    failures += 1;
    console.error(`[${i + 1}/${urls.length}] failed ${url}: ${error.message}`);
  }
  if (delayMs > 0 && i < urls.length - 1) await sleep(delayMs);
}

if (!pages.length) throw new Error(`Crawl produced zero pages for ${marketCode}; previous data left untouched`);

const currentDir = path.join(ROOT, "data/current", marketCode);
const historyDir = path.join(ROOT, "data/history/products");
await mkdir(currentDir, { recursive: true });
await mkdir(historyDir, { recursive: true });

const products = [...productMap.values()];
const historyFile = path.join(historyDir, `${marketCode}.jsonl`);
const history = await readJsonl(historyFile);
const latestFingerprint = new Map();
for (const item of history) latestFingerprint.set(item.key, item.fingerprint);

for (const product of products) {
  if (latestFingerprint.get(product.key) !== product.fingerprint) history.push(product);
}

const toJsonl = (rows) => rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");

await writeFile(path.join(currentDir, "pages.jsonl"), toJsonl(pages));
await writeFile(path.join(currentDir, "products.jsonl"), toJsonl(products));
await writeFile(historyFile, toJsonl(history));
await writeFile(path.join(currentDir, "meta.json"), JSON.stringify({
  market: marketCode,
  base_url: market.baseUrl,
  captured_at: capturedAt,
  requested_urls: urls.length,
  pages_written: pages.length,
  products_written: products.length,
  failures,
  history_versions: history.length
}, null, 2) + "\n");

console.error(`done: ${marketCode}: ${pages.length} pages, ${products.length} products, ${failures} failures`);
