import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const market = process.argv.find(a => a.startsWith("--market="))?.split("=")[1] || "kr";
const dir = path.join(root, "data/marts", market);
async function json(name, fallback) { try { return JSON.parse(await readFile(path.join(dir, name), "utf8")); } catch { return fallback; } }
async function jsonl(name) { try { return (await readFile(path.join(dir, name), "utf8")).split(/\r?\n/).filter(Boolean).map(JSON.parse); } catch { return []; } }
const coverage = await json("current_catalog_coverage.json", null);
const readiness = await json("chatbot_readiness.json", null);
const products = await jsonl("product_master.jsonl");
const specs = await jsonl("product_specs.jsonl");
const supports = await jsonl("support_resources.jsonl");
const specKeys = new Set(specs.filter(s => s.market_product_key && (s.specs?.length || s.specifications?.length || Object.keys(s.attributes || {}).length)).map(s => s.market_product_key));
const supportKeys = new Set(supports.flatMap(s => [s.market_product_key, ...(s.market_product_keys || [])]).filter(Boolean));
const categories = (coverage?.categories || []).map(c => ({
  business_unit: c.business_unit, category: c.category, source_id: c.source_id,
  status: c.source_status, discovered_skus: c.discovered_unique_skus,
  db_skus: c.db_current_unique_skus, complete: c.complete,
  missing_in_db: c.missing_in_db || [], unexpected_in_db: c.unexpected_in_db || []
}));
const gaps = products.filter(p => ["current_sellable","current_out_of_stock","current_not_directly_sellable"].includes(p.lifecycle_status))
  .map(p => ({
    sku: p.sku, market_product_key: p.market_product_key, business_unit: p.business_unit,
    category: p.category || p.category_path?.join(" / ") || "",
    name: p.name || "", url: p.product_url || p.url || "",
    has_specs: specKeys.has(p.market_product_key),
    has_support: supportKeys.has(p.market_product_key)
  })).filter(p => !p.has_specs || !p.has_support);
const report = {
  market, generated_at: new Date().toISOString(),
  source_snapshot_at: coverage?.generated_at || null,
  ready: readiness?.ready === true && coverage?.complete === true,
  catalog: { sources_total: coverage?.catalog_sources_total ?? null, sources_failed: coverage?.catalog_sources_failed ?? null, categories },
  counts: { current_products: products.length, specs_rows: specs.length, support_rows: supports.length, products_missing_specs_or_support: gaps.length },
  sku_gaps: gaps,
  notes: ["Catalog source completeness means reconciliation with discovered IDs, not independently verified full Samsung.com inventory.", "Do not treat a failed category as an empty catalog.", "SKU support and spec evidence must be independently verified."]
};
await mkdir(dir, {recursive:true});
await writeFile(path.join(dir, "quality_backlog.json"), JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({market, gaps:gaps.length, failed_sources:report.catalog.sources_failed}));
