import test from "node:test";
import assert from "node:assert/strict";
import {
  currentPrice, searchCatalog, extractBudget, runDemoQuestion
} from "../web/agent-demo.js";

const NOW = Date.parse("2026-10-21T07:00:00.000Z");
const url = sku => "https://www.samsung.com/sec/smartphones/demo/" + sku + "/";
const make = (sku, name, status = "current_sellable", price = "1200000") => ({
  key: sku, sku, model: sku, name, category: "smartphones",
  lifecycle: status, source_url: url(sku), variants: {},
  specs: [{ name: "배터리 용량", value: "4300", unit: "mAh" }],
  offer: price ? {
    price, currency: "KRW", source_url: url(sku),
    checked_at: new Date(NOW - 2 * 3600000).toISOString()
  } : null
});
const flip = make("SM-TEST-FLIP", "Galaxy Z Flip");
const fold = make("SM-TEST-FOLD", "Galaxy Z Fold", "current_sellable", "1990000");
const old = make("SM-TEST-OLD", "Galaxy Z Old", "current_unavailable");
const snapshot = { market: "kr", generated_at: new Date(NOW).toISOString(),
  products: [flip, fold, old] };

test("static search returns only source-linked current sellable smartphone variants", () => {
  const result = searchCatalog(snapshot.products, "갤럭시", { now: NOW });
  assert.deepEqual(result.products.map(x => x.sku), ["SM-TEST-FLIP", "SM-TEST-FOLD"]);
  assert.equal(searchCatalog(snapshot.products, "flip", { now: NOW }).matched, 1);
  assert.equal(searchCatalog(snapshot.products, "SM-TEST-FOLD", { now: NOW }).matched, 1);
  const polluted = [...snapshot.products, {
    ...flip, sku: "SM-EXTERNAL", source_url: "https://example.com/price"
  }];
  assert.equal(searchCatalog(polluted, "", { now: NOW }).matched, 2);
});

test("observed prices are never labeled MSRP; stale and fake sources are refused", () => {
  const price = currentPrice(flip, NOW);
  assert.equal(price.status, "verified_recently");
  assert.equal(price.price_type, "observed_site_price_not_verified_msrp");
  assert.equal(currentPrice(flip, NOW + 40 * 3600000).amount, null);
  assert.equal(currentPrice(old, NOW).amount, null);
  assert.equal(currentPrice({ ...flip, offer: { ...flip.offer, source_url: "https://fake.example/" } }, NOW).amount, null);
  assert.equal(currentPrice({ ...flip, offer: { ...flip.offer, checked_at: new Date(NOW + 3600000).toISOString() } }, NOW).amount, null);
});

test("Korean budget parser and price filter never silently invent discounts", () => {
  assert.equal(extractBudget("150만원 이하"), 1500000);
  assert.equal(extractBudget("100만 원 이하"), 1000000);
  assert.equal(extractBudget("1,500,000원"), 1500000);
  const accepted = runDemoQuestion("150만원 이하 갤럭시 추천", snapshot, NOW);
  assert.equal(accepted.products[0].sku, "SM-TEST-FLIP");
  assert.equal(accepted.products.length, 1);
  assert.match(accepted.answer, /공시가.*아닙니다/);
  const stale = runDemoQuestion("150만원 이하 갤럭시 추천", snapshot, NOW + 100 * 3600000);
  assert.match(stale.answer, /유효한 가격 근거/);
  assert.ok(stale.products.every(p => p.price.amount === null));
});

test("specs comparison uses exact variant evidence and traceable local tool calls", () => {
  const specs = runDemoQuestion("플립 주요 스펙 알려줘", snapshot, NOW);
  assert.match(specs.answer, /4300 mAh/);
  assert.equal(specs.developer.tools[1].name, "get_product_specs");
  assert.equal(specs.developer.tools[1].execution, "in_browser_static_demo");
  const comp = runDemoQuestion("플립과 폴드 차이 비교", snapshot, NOW);
  assert.equal(comp.products.length, 2);
  assert.equal(comp.developer.tools[0].name, "compare_products");
  assert.match(comp.answer, /SM-TEST-FLIP/);
});

test("no stock/order hallucinations and absent snapshot are explicitly reported", () => {
  const inventory = runDemoQuestion("플립 재고가 있어?", snapshot, NOW);
  assert.match(inventory.answer, /연결되지 않았습니다/);
  assert.equal(inventory.products.length, 0);
  const absent = runDemoQuestion("플립 스펙 알려줘", { products: [] }, NOW);
  assert.match(absent.answer, /불러오지 못했습니다/);
  const noSpecs = runDemoQuestion("플립 스펙 알려줘", { products: [{
    ...flip, specs: []
  }] }, NOW);
  assert.match(noSpecs.answer, /확인할 수 없습니다/);
});
