/**
 * Read-only customer shopping tools over existing Samsung.com KR data marts.
 * Never invent missing specifications or re-label a crawled price as MSRP.
 * This module is intentionally independent of the LLM and MCP transport.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const VALID_MARKET = /^[a-z]{2}$/;
const SELLABLE = "current_sellable";

function officialUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === "www.samsung.com" ? url.href : null;
  } catch { return null; }
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}
async function readJsonl(file) {
  const contents = await readJsonlText(file);
  return contents === null ? null : contents.split(/\r?\n/).filter(Boolean).map(JSON.parse);
}
async function readJsonlText(file) {
  try { return await readFile(file, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

function canSell(product) {
  return product?.lifecycle_status === SELLABLE && product.commerce_eligible === true;
}

function observedPrice(product, offer, refresh, now, maxAgeHours) {
  if (!canSell(product)) {
    return { status: "not_verified_sellable", amount: null };
  }
  const timestamp = Date.parse(refresh?.offer_checked_at || "");
  const amount = Number(String(offer?.price || "").replaceAll(",", ""));
  const sourceUrl = officialUrl(offer?.purchase_url);
  if (!sourceUrl || !Number.isFinite(amount) || amount <= 0 || !offer?.currency) {
    return { status: "unavailable", amount: null };
  }
  if (!Number.isFinite(timestamp) || timestamp > now ||
      now - timestamp > maxAgeHours * 3600000) {
    return { status: "stale_or_unverified", amount: null };
  }
  return {
    status: "verified_recently",
    amount,
    currency: offer.currency,
    price_type: "observed_site_price_not_verified_msrp",
    verified_at: refresh.offer_checked_at,
    source_url: sourceUrl
  };
}

function normalizeSpecs(specRow) {
  const sourceUrl = officialUrl(specRow?.source_url);
  if (!sourceUrl) return { status: "unverified_source", specs: [], source_url: null };
  const specs = (specRow?.specs || [])
    .filter(item => item && item.value !== null && item.value !== undefined &&
      String(item.value).trim() !== "")
    .map(item => ({
      key: String(item.key || item.name || ""),
      name: String(item.name || item.key || ""),
      value: String(item.value),
      unit: item.unit || null
    })).filter(item => item.key || item.name);
  return { status: specs.length ? "collected_unverified" : "missing", specs, source_url: sourceUrl };
}

function batteryMah(spec) {
  const item = spec.specs.find(item => /battery|배터리/i.test(item.key + " " + item.name) &&
    /capacity|용량|배터리|battery/i.test(item.key + " " + item.name));
  if (!item) return null;
  const match = String(item.value).replaceAll(",", "").match(/(\d{3,5})(?:\s*mAh)?/i);
  return match ? Number(match[1]) : null;
}

function productSummary(product, spec, price) {
  return {
    sku: product.sku,
    model: product.model || null,
    name: product.name || product.product_family || product.sku,
    category: product.category || null,
    business_unit: product.business_unit || null,
    lifecycle_status: product.lifecycle_status,
    product_url: officialUrl(product.product_url),
    spec_status: spec.status,
    spec_count: spec.specs.length,
    price
  };
}

export function createCustomerTools({ root = process.cwd(), now = () => Date.now() } = {}) {
  const getSnapshot = async market => {
    market = String(market || "kr").toLowerCase();
    if (!VALID_MARKET.test(market)) throw new Error("Invalid market");
    const folder = path.join(root, "data", "marts", market);
    const [master, specs, offers, refresh, policy] = await Promise.all([
      readJsonl(path.join(folder, "product_master.jsonl")),
      readJsonl(path.join(folder, "product_specs.jsonl")),
      readJsonl(path.join(folder, "market_offers.jsonl")),
      readJsonl(path.join(folder, "refresh_state.jsonl")),
      readJson(path.join(root, "config", "refresh-policy.json"), {})
    ]);
    if (!master) return null;
    const byKey = rows => new Map((rows || []).map(row => [row.market_product_key, row]));
    const configured = Number(policy.max_offer_age_hours_for_mcp);
    return {
      market, master,
      specs: byKey(specs), offers: byKey(offers), refresh: byKey(refresh),
      maxAgeHours: configured > 0 && Number.isFinite(configured) ? configured : 36
    };
  };

  const enrich = (snapshot, product) => {
    const key = product.market_product_key;
    return {
      specs: normalizeSpecs(snapshot.specs.get(key)),
      price: observedPrice(product, snapshot.offers.get(key),
        snapshot.refresh.get(key), now(), snapshot.maxAgeHours)
    };
  };

  async function search_products(args = {}) {
    const { market = "kr", query = "", category = null, max_price = null,
      min_battery_mah = null, limit = 10 } = args;
    const snapshot = await getSnapshot(market);
    if (!snapshot) return { status: "data_unavailable", products: [] };
    const terms = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
    const results = [];
    for (const p of snapshot.master) {
      if (!canSell(p) || !officialUrl(p.product_url)) continue;
      if (category && String(p.category || "").toLowerCase() !== String(category).toLowerCase()) continue;
      const haystack = [p.name, p.model, p.sku, p.product_family,
        ...(p.category_path || [])].join(" ").toLowerCase();
      if (!terms.every(term => haystack.includes(term))) continue;
      const { specs, price } = enrich(snapshot, p);
      if (max_price !== null && (price.status !== "verified_recently" ||
          price.currency !== "KRW" || price.amount > Number(max_price))) continue;
      if (min_battery_mah !== null && (batteryMah(specs) === null ||
          batteryMah(specs) < Number(min_battery_mah))) continue;
      results.push(productSummary(p, specs, price));
    }
    return {
      status: "ok", market: snapshot.market,
      products: results.slice(0, Math.max(1, Math.min(30, Number(limit) || 10))),
      matched: results.length,
      caveat: "Only discovered, explicitly sellable SKUs. Price and specs may be absent; discovered catalog is not a certified full inventory."
    };
  }

  async function lookup(market, sku) {
    const snapshot = await getSnapshot(market);
    if (!snapshot) return { error: "data_unavailable" };
    const product = snapshot.master.find(p =>
      String(p.sku || "").toUpperCase() === String(sku || "").trim().toUpperCase());
    if (!product || !officialUrl(product.product_url)) return { error: "sku_not_found_or_unverified" };
    return { snapshot, product, ...enrich(snapshot, product) };
  }

  async function get_product_specs({ market = "kr", sku } = {}) {
    const result = await lookup(market, sku);
    if (result.error) return { status: result.error, sku };
    return {
      status: result.specs.status,
      product: productSummary(result.product, result.specs, { status: "not_requested", amount: null }),
      source_url: result.specs.source_url,
      specs: result.specs.specs
    };
  }

  async function get_product_price({ market = "kr", sku } = {}) {
    const result = await lookup(market, sku);
    if (result.error) return { status: result.error, sku };
    return {
      status: result.price.status, sku: result.product.sku,
      product_url: officialUrl(result.product.product_url),
      price: result.price,
      caveat: "A scraped current offer is not proof of official MSRP/list price. Do not call it an official list price unless separately verified."
    };
  }

  async function compare_products({ market = "kr", skus = [] } = {}) {
    if (!Array.isArray(skus) || skus.length < 2 || skus.length > 4) {
      return { status: "invalid_skus", products: [] };
    }
    const unique = [...new Set(skus.map(x => String(x).toUpperCase()))];
    if (unique.length !== skus.length) return { status: "duplicate_skus", products: [] };
    const products = await Promise.all(skus.map(async sku => {
      const result = await lookup(market, sku);
      if (result.error) return { sku, status: result.error };
      return {
        ...productSummary(result.product, result.specs, result.price),
        specs: result.specs.specs,
        specs_source_url: result.specs.source_url
      };
    }));
    return {
      status: "ok", market, products,
      caveat: "Missing facts must not be inferred; values can differ by market SKU. Prices are recent observed offers, not verified MSRP."
    };
  }

  return { search_products, get_product_specs, get_product_price, compare_products };
}
