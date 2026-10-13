/**
 * Publish a small, source-linked KR SKU demo from the very same marts exposed to
 * the local MCP server. Run during GitHub Pages assembly; no server required.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";

export const OFFICIAL_HOST = "www.samsung.com";

const root = process.cwd();
const martDir = join(root, "data/marts/kr");
const output = resolve(root, process.argv[2] || "dist/data/demo/kr.json");

const readJsonl = async name => {
  const content = await readFile(join(martDir, name + ".jsonl"), "utf8");
  return content.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
};
const readJson = async name => JSON.parse(await readFile(join(martDir, name), "utf8"));

function officialUrl(value) {
  if (typeof value !== "string") return "";
  try {
    const uri = new URL(value);
    return uri.protocol === "https:" && uri.hostname === OFFICIAL_HOST ? uri.href : "";
  } catch { return ""; }
}

export function buildDemoData({ master, specs, offers, refresh, support, readiness }) {
  const specByKey = new Map(specs.map(x => [x.market_product_key, x]));
  const offerByKey = new Map(offers.map(x => [x.market_product_key, x]));
  const refreshByKey = new Map(refresh.map(x => [x.market_product_key, x]));
  const supportBySku = new Map();
  for (const item of support) {
    // Generic support pages must NEVER be implied to be model-specific evidence.
    for (const value of [item.sku, item.model, item.market_product_key].filter(Boolean)) {
      const key = String(value).toUpperCase();
      if (!supportBySku.has(key)) supportBySku.set(key, []);
      supportBySku.get(key).push(item);
    }
  }
  const products = master
    .filter(p => ["current_sellable", "current_unavailable"].includes(p.lifecycle_status))
    .filter(p => ["DA", "VD", "MX", "HARMAN"].includes(p.business_unit))
    .filter(p => officialUrl(p.product_url) && /^[A-Z0-9][A-Z0-9-]{4,50}$/.test(String(p.sku || "")))
    .map(p => {
      const spec = specByKey.get(p.market_product_key);
      const offer = offerByKey.get(p.market_product_key);
      const state = refreshByKey.get(p.market_product_key);
      const canQuote = p.lifecycle_status === "current_sellable" &&
        p.commerce_eligible === true && Boolean(offer?.price) &&
        Boolean(state?.offer_checked_at) &&
        Number.isFinite(Date.parse(state.offer_checked_at));
      const linked = (supportBySku.get(String(p.sku).toUpperCase()) || []).filter(x => officialUrl(x.source_url));
      return {
        key: p.market_product_key,
        sku: p.sku,
        name: p.name || p.model || p.sku,
        bu: p.business_unit,
        category: p.category,
        model: p.model,
        lifecycle: p.lifecycle_status,
        variants: p.variant_attributes || {},
        source_url: officialUrl(p.product_url),
        captured_at: p.captured_at || null,
        specs: (spec?.specs || [])
          .filter(x => x && x.value !== null && x.value !== undefined && String(x.value).trim())
          .slice(0, 36)
          .map(x => ({ name: String(x.name || x.key || "Specification"), value: String(x.value), unit: x.unit || "" })),
        specs_source_url: officialUrl(spec?.source_url) || officialUrl(p.product_url),
        offer: canQuote ? {
          price: String(offer.price), currency: offer.currency || "KRW",
          captured_at: offer.captured_at || null,
          checked_at: state.offer_checked_at,
          source_url: officialUrl(offer.purchase_url)
        } : null,
        support: linked.slice(0, 5).map(x => ({
          title: x.title || "Support", url: officialUrl(x.source_url),
          captured_at: x.captured_at || null
        }))
      };
    })
    .sort((a,b) => {
      const aScore=(a.specs.length ? 5 : 0)+(a.offer ? 3 : 0)+(a.support.length ? 2 : 0);
      const bScore=(b.specs.length ? 5 : 0)+(b.offer ? 3 : 0)+(b.support.length ? 2 : 0);
      return bScore-aScore || a.name.localeCompare(b.name,"ko") || a.sku.localeCompare(b.sku);
    });

  return {
    schema_version: 1,
    market: "kr",
    generated_at: readiness.generated_at || null,
    source: "Samsung.com KR collected marts; static POC, not an MCP call",
    note: "All offers require client-side max-age checks at display time; stock and delivery require official live APIs.",
    stats: {
      sku_count: products.length,
      with_specs: products.filter(p => p.specs.length).length,
      with_offer_evidence: products.filter(p => p.offer).length,
      with_linked_support: products.filter(p => p.support.length).length,
      ready: readiness.ready === true
    },
    products
  };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const [master,specs,offers,refresh,support,readiness] = await Promise.all([
    readJsonl("product_master"),readJsonl("product_specs"),
    readJsonl("market_offers"),readJsonl("refresh_state"),
    readJsonl("support_resources"),readJson("chatbot_readiness.json")
  ]);
  const data = buildDemoData({master,specs,offers,refresh,support,readiness});
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output, JSON.stringify(data));
  console.log(JSON.stringify({output,stats:data.stats}));
}
