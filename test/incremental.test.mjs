import test from "node:test";
import assert from "node:assert/strict";
import { reconcileDataMarts, updateImmutableSkuRegistry, isVerifiedFresh } from "../src/pipeline/incremental.mjs";
import { selectDueUrls, recordAttempt } from "../src/pipeline/scheduler.mjs";

const AT = "2026-10-13T04:00:00.000Z";
const sku = "kr:TEST123";
const master = { market_product_key: sku, sku: "TEST123", market: "kr", name: "Galaxy Example", lifecycle_status: "current_sellable", commerce_eligible: true, captured_at: "2026-10-01T00:00:00.000Z" };
const spec = { market_product_key: sku, specs: [{ name: "RAM", value: "8GB" }], captured_at: "2026-10-01T00:00:00.000Z" };
const offer = { market_product_key: sku, price: "900", currency: "KRW", captured_at: "2026-10-01T00:00:00.000Z" };
const commerce = { market_product_key: sku, delivery: [{ label: "Delivery", captured_at: "2026-10-01T00:00:00.000Z" }], captured_at: "2026-10-01T00:00:00.000Z" };
const base = () => ({ productMaster: [master], productSpecs: [spec], marketOffers: [offer], commerceOptions: [commerce], supportResources: [] });

test("unchanged spec/price do not rewrite their snapshots, only verification time advances", () => {
  const prior = base();
  const next = base();
  next.productMaster = [{ ...master, captured_at: AT, catalog_verified_at: AT }];
  next.productSpecs = [{ ...spec, captured_at: AT }];
  next.marketOffers = [{ ...offer, captured_at: AT }];
  next.commerceOptions = [{ ...commerce, captured_at: AT, delivery: [{ label: "Delivery", captured_at: AT }] }];
  const r = reconcileDataMarts(prior, next, {
    capturedAt: AT, freshOfferKeys: new Set([sku]), freshCommerceKeys: new Set([sku])
  });
  assert.equal(r.stats.new_skus, 0);
  assert.equal(r.stats.unchanged_master, 1);
  assert.equal(r.stats.specs_enriched_or_corrected, 0);
  assert.equal(r.stats.offers_changed, 0);
  assert.equal(r.stats.commerce_changed, 0);
  assert.deepEqual(r.marts.productSpecs[0], spec);
  assert.equal(r.freshness[0].offer_checked_at, AT);
  assert.equal(r.freshness[0].commerce_checked_at, AT);
});

test("only dynamic offer changes on fresh price observation", () => {
  const prior = base(), next = base();
  next.marketOffers = [{ ...offer, price: "800", captured_at: AT }];
  const r = reconcileDataMarts(prior, next, { capturedAt: AT, freshOfferKeys: new Set([sku]) });
  assert.equal(r.stats.offers_changed, 1);
  assert.equal(r.stats.specs_enriched_or_corrected, 0);
  assert.equal(r.marts.marketOffers[0].price, "800");
  assert.equal(r.marts.productSpecs[0].captured_at, spec.captured_at);
});

test("cached pages cannot impersonate a fresh offer or erase commerce evidence", () => {
  const prior = base(), next = base();
  next.marketOffers = [{ ...offer, price: "100", captured_at: AT }];
  next.commerceOptions = [{ market_product_key: sku, delivery: [], captured_at: AT }];
  const r = reconcileDataMarts(prior, next, { capturedAt: AT });
  assert.equal(r.stats.offers_verified, 0);
  assert.equal(r.marts.marketOffers[0].price, "900");
  assert.equal(r.marts.commerceOptions[0].delivery.length, 1);
  assert.equal(r.freshness[0].offer_checked_at, null);
});

test("a failed source/unverified lifecycle cannot expose stale offers", () => {
  const next = base();
  next.productMaster = [{ ...master, lifecycle_status: "unverified", commerce_eligible: null }];
  const r = reconcileDataMarts(base(), next, { capturedAt: AT, freshOfferKeys: new Set([sku]) });
  assert.equal(r.marts.marketOffers.length, 0);
  assert.equal(r.marts.commerceOptions.length, 0);
});

test("known specs survive a partial scrape; one-time empty registry backfills", () => {
  const prior = base(), next = base();
  next.productSpecs = [{ ...spec, specs: [] }];
  const r = reconcileDataMarts(prior, next, { capturedAt: AT });
  assert.deepEqual(r.marts.productSpecs[0].specs, spec.specs);
  const updated = updateImmutableSkuRegistry([{ sku: "TEST123", specs: [], first_seen_at: "2026-01-01" }], [master], [spec], AT);
  assert.equal(updated[0].first_seen_at, "2026-01-01");
  assert.deepEqual(updated[0].specs, spec.specs);
  const unchanged = updateImmutableSkuRegistry(updated, [master], [{ ...spec, specs: [{ name: "RAM", value: "4GB" }] }], AT);
  assert.deepEqual(unchanged[0].specs, spec.specs);
});

test("freshness does not confuse last changed with last checked", () => {
  assert.equal(isVerifiedFresh({ offer_checked_at: AT }, "offer_checked_at", Date.parse(AT) + 3600000, 36), true);
  assert.equal(isVerifiedFresh({ offer_checked_at: AT }, "offer_checked_at", Date.parse(AT) + 40*3600000, 36), false);
});

test("new discovery does not starve critical commerce checks", () => {
  const now = Date.parse(AT);
  const urls = ["https://www.samsung.com/sec/buy/a", "https://www.samsung.com/sec/product/b", "https://www.samsung.com/sec/product/c"];
  const selected = selectDueUrls(urls, new Set([urls[0]]), [{ url: urls[0], captured_at: "2026-10-01T00:00:00Z" }], {}, { at: now, batchSize: 2 });
  assert.deepEqual(selected.selected, [urls[0], urls[1]]);
});

test("failing URLs cool down; successful retries clear the backoff", () => {
  const url = "https://www.samsung.com/sec/product/fail";
  const attempts = recordAttempt({}, url, false, AT);
  assert.equal(attempts[url].failure_count, 1);
  const r = selectDueUrls([url], new Set(), [], attempts, { at: Date.parse(AT) + 1000, batchSize: 2 });
  assert.equal(r.selected.length, 0);
  recordAttempt(attempts, url, true, AT);
  assert.equal(attempts[url], undefined);
});
