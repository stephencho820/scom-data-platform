import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCustomerTools } from "../src/agent/customer-tools.mjs";

const NOW = Date.parse("2026-10-20T06:00:00.000Z");
const url = sku => "https://www.samsung.com/sec/smartphones/sample/" + sku + "/";
const product = (sku, name, lifecycle_status = "current_sellable") => ({
  market_product_key: sku, sku, model: sku, market: "kr",
  name, product_family: name, category: "smartphones", business_unit: "MX",
  product_url: url(sku), lifecycle_status, commerce_eligible: lifecycle_status === "current_sellable"
});
const products = [
  product("SM-TEST-FLIP", "Galaxy Flip"),
  product("SM-TEST-FOLD", "Galaxy Fold"),
  product("SM-TEST-OLD", "Galaxy Older", "discontinued")
];
const specs = [
  { market_product_key: "SM-TEST-FLIP", source_url: url("SM-TEST-FLIP"),
    specs: [{ key: "battery_capacity", name: "Battery capacity", value: "4300", unit: "mAh" }] },
  { market_product_key: "SM-TEST-FOLD", source_url: url("SM-TEST-FOLD"),
    specs: [{ key: "battery_capacity", name: "Battery capacity", value: "5000", unit: "mAh" }] }
];
const offers = products.map((p, i) => ({
  market_product_key: p.sku, price: String(1200000 + 200000 * i),
  currency: "KRW", purchase_url: url(p.sku)
}));
const refresh = products.map(p => ({
  market_product_key: p.sku, offer_checked_at: "2026-10-20T02:00:00.000Z"
}));

async function fixture(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "customer-agent-"));
  const target = path.join(root, "data", "marts", "kr");
  await mkdir(target, { recursive: true });
  const writeRows = (table, values) =>
    writeFile(path.join(target, table + ".jsonl"), values.map(JSON.stringify).join("\n") + "\n");
  await Promise.all([
    writeRows("product_master", overrides.products ?? products),
    writeRows("product_specs", overrides.specs ?? specs),
    writeRows("market_offers", overrides.offers ?? offers),
    writeRows("refresh_state", overrides.refresh ?? refresh)
  ]);
  await mkdir(path.join(root, "config"));
  await writeFile(path.join(root, "config", "refresh-policy.json"),
    JSON.stringify({ max_offer_age_hours_for_mcp: 36 }));
  return { root, clean: () => rm(root, { recursive: true, force: true }) };
}

test("search selects only sellable, source-linked SKUs; supports price and battery filters", async () => {
  const f = await fixture();
  try {
    const tools = createCustomerTools({ root: f.root, now: () => NOW });
    const all = await tools.search_products({ market: "kr", query: "Galaxy" });
    assert.equal(all.matched, 2);
    assert.ok(all.products.every(x => x.lifecycle_status === "current_sellable"));
    const filtered = await tools.search_products({ market: "kr", category: "smartphones",
      max_price: 1500000, min_battery_mah: 4200 });
    assert.deepEqual(filtered.products.map(x => x.sku), ["SM-TEST-FLIP", "SM-TEST-FOLD"]);
    const strict = await tools.search_products({ market: "kr",
      max_price: 1500000, min_battery_mah: 4800 });
    assert.deepEqual(strict.products.map(x => x.sku), ["SM-TEST-FOLD"]);
  } finally { await f.clean(); }
});

test("specs are linked to exact SKU and do not fabricate missing data", async () => {
  const f = await fixture();
  try {
    const tools = createCustomerTools({ root: f.root, now: () => NOW });
    const s = await tools.get_product_specs({ sku: "sm-test-flip" });
    assert.equal(s.status, "collected_unverified");
    assert.equal(s.specs[0].value, "4300");
    assert.equal(s.source_url, url("SM-TEST-FLIP"));
    const missing = await tools.get_product_specs({ sku: "SM-TEST-OLD" });
    assert.deepEqual(missing.specs, []);
    assert.equal(missing.status, "missing");
    assert.equal((await tools.get_product_specs({ sku: "SM-NOT-FOUND" })).status, "sku_not_found_or_unverified");
  } finally { await f.clean(); }
});

test("verified recent offer is not mislabeled as official MSRP; legacy suppresses prices", async () => {
  const f = await fixture();
  try {
    const tools = createCustomerTools({ root: f.root, now: () => NOW });
    const result = await tools.get_product_price({ sku: "SM-TEST-FLIP" });
    assert.equal(result.status, "verified_recently");
    assert.equal(result.price.amount, 1200000);
    assert.equal(result.price.price_type, "observed_site_price_not_verified_msrp");
    assert.equal((await tools.get_product_price({ sku: "SM-TEST-OLD" })).price.amount, null);
  } finally { await f.clean(); }
});

test("stale, future, invalid sources, and absent verification cannot be quoted", async () => {
  const f = await fixture({ offers: offers.map((o, i) =>
    i === 0 ? { ...o, purchase_url: "https://evil.example/price" } : o) });
  try {
    const tools = createCustomerTools({ root: f.root, now: () => NOW });
    assert.equal((await tools.get_product_price({ sku: "SM-TEST-FLIP" })).status, "unavailable");
    assert.equal((await tools.search_products({ max_price: 1500000 })).matched, 1);
  } finally { await f.clean(); }
  const stale = await fixture();
  try {
    const tools = createCustomerTools({ root: stale.root, now: () => NOW + 60 * 3600000 });
    assert.equal((await tools.get_product_price({ sku: "SM-TEST-FLIP" })).status, "stale_or_unverified");
    assert.equal((await tools.search_products({ max_price: 1500000 })).matched, 0);
  } finally { await stale.clean(); }
});

test("comparison joins each SKU without estimating absent facts", async () => {
  const f = await fixture();
  try {
    const tools = createCustomerTools({ root: f.root, now: () => NOW });
    const comparison = await tools.compare_products({ skus: ["SM-TEST-FLIP", "SM-TEST-OLD"] });
    assert.equal(comparison.products.length, 2);
    assert.equal(comparison.products[0].specs[0].value, "4300");
    assert.equal(comparison.products[1].price.amount, null);
    assert.deepEqual(comparison.products[1].specs, []);
    assert.equal((await tools.compare_products({ skus: ["a", "a"] })).status, "duplicate_skus");
  } finally { await f.clean(); }
});
