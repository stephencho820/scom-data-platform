import { createHash } from "node:crypto";

const KEY = "market_product_key";
const CHECKED = new Set(["captured_at", "catalog_verified_at", "fingerprint", "spec_captured_at", "last_checked_at"]);
const COMMERCE_FIELDS = ["purchase_methods", "subscriptions", "trade_in", "protection", "delivery", "installation", "haul_away", "bundles", "membership"];

function cleaned(value) {
  if (Array.isArray(value)) return value.map(cleaned);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !CHECKED.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, cleaned(item)]));
}

export function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(cleaned(value))).digest("hex");
}

const keyOf = (row) => String(row?.[KEY] || row?.sku_key || "");
const byKey = (rows = []) => new Map(rows.filter(keyOf).map((row) => [keyOf(row), row]));
const notEmpty = (rows) => Array.isArray(rows) && rows.length > 0;
const rowsSorted = (rows) => rows.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));

export function reconcileDataMarts(previous, next, { capturedAt, freshOfferKeys = new Set(), freshCommerceKeys = new Set(), previousFreshness = [] } = {}) {
  const previousMaster = byKey(previous.productMaster);
  const previousSpecs = byKey(previous.productSpecs);
  const previousOffers = byKey(previous.marketOffers);
  const previousCommerce = byKey(previous.commerceOptions);
  const previousSupport = new Map((previous.supportResources || []).map(row => [row.support_key, row]));
  const oldFreshness = byKey(previousFreshness);
  const stats = {
    new_skus: 0, master_changed: 0, specs_enriched_or_corrected: 0,
    offers_changed: 0, commerce_changed: 0, support_changed: 0,
    offers_verified: 0, commerce_verified: 0, unchanged_master: 0
  };

  const productMaster = rowsSorted(next.productMaster.map(row => {
    const old = previousMaster.get(keyOf(row));
    if (!old) { stats.new_skus++; return row; }
    if (fingerprint(old) === fingerprint(row)) { stats.unchanged_master++; return old; }
    stats.master_changed++;
    return { ...row, captured_at: old.captured_at || row.captured_at };
  }));
  const masterByKey = byKey(productMaster);
  const productSpecs = rowsSorted(next.productSpecs.map(row => {
    const old = previousSpecs.get(keyOf(row));
    if (!old) { if (notEmpty(row.specs)) stats.specs_enriched_or_corrected++; return row; }
    // Never regress a verified spec profile to an empty/partial scrape.
    if ((row.specs || []).length < (old.specs || []).length) return old;
    if (fingerprint(old) === fingerprint(row)) return old;
    if (notEmpty(row.specs)) stats.specs_enriched_or_corrected++;
    return row;
  }));

  const reconcileLive = (name, proposedRows, previousRows, freshKeys, statKey, verifiedKey) => {
    const proposed = byKey(proposedRows);
    const old = byKey(previousRows);
    const output = [];
    const freshness = new Map();
    for (const [key, master] of masterByKey) {
      // A cached PDP is NOT proof of an active offer. Never expose commerce for
      // unverified, discontinued, sold-out, or otherwise ineligible products.
      if (master.commerce_eligible !== true || master.lifecycle_status !== "current_sellable") continue;
      const proposedRow = proposed.get(key);
      const oldRow = old.get(key);
      const verified = freshKeys.has(key) && Boolean(proposedRow);
      const row = verified ? proposedRow : oldRow;
      if (!row) continue;
      const normalized = { ...row, fingerprint: fingerprint(row) };
      if (!oldRow || fingerprint(oldRow) !== normalized.fingerprint) {
        stats[statKey]++;
        output.push(normalized);
      } else {
        output.push(oldRow.fingerprint === normalized.fingerprint ? oldRow : { ...oldRow, fingerprint: normalized.fingerprint });
      }
      if (verified) { stats[verifiedKey]++; freshness.set(key, capturedAt); }
    }
    return { rows: rowsSorted(output), freshness };
  };

  const offers = reconcileLive("offers", next.marketOffers, previous.marketOffers, freshOfferKeys, "offers_changed", "offers_verified");
  const commerce = reconcileLive("commerce", next.commerceOptions, previous.commerceOptions, freshCommerceKeys, "commerce_changed", "commerce_verified");

  const supportResources = (next.supportResources || []).map(row => {
    const old = previousSupport.get(row.support_key);
    if (old && fingerprint(old) === fingerprint(row)) return old;
    stats.support_changed++;
    return row;
  });

  const freshness = rowsSorted([...masterByKey.keys()].map(key => {
    const prev = oldFreshness.get(key) || {};
    const offer_checked_at = offers.freshness.get(key) || prev.offer_checked_at || null;
    const commerce_checked_at = commerce.freshness.get(key) || prev.commerce_checked_at || null;
    return { market_product_key: key, offer_checked_at, commerce_checked_at };
  }));

  return {
    marts: { ...next, productMaster, productSpecs, marketOffers: offers.rows, commerceOptions: commerce.rows, supportResources },
    freshness,
    stats,
    report: {
      schema_version: 1,
      market: productMaster[0]?.market || next.productMaster[0]?.market || "unknown",
      checked_at: capturedAt,
      policy: "immutable-once, versioned-on-change, offers-from-verified-source-only",
      stats
    }
  };
}

export function updateImmutableSkuRegistry(oldRows, productMaster, productSpecs, capturedAt) {
  const latest = new Map((oldRows || []).filter(row => row.sku).map(row => [String(row.sku).toUpperCase(), row]));
  const specs = byKey(productSpecs);
  for (const item of productMaster) {
    const sku = String(item.sku || "").trim().toUpperCase();
    if (!sku) continue;
    const old = latest.get(sku);
    const verifiedSpecs = specs.get(keyOf(item))?.specs || [];
    if (old) {
      // Historical placeholders can be enriched exactly once after trustworthy
      // specs become available, but populated immutable profiles are not re-scraped.
      if (!notEmpty(old.specs) && notEmpty(verifiedSpecs)) {
        latest.set(sku, { ...old, specs: verifiedSpecs, immutable_profile_captured_at: capturedAt });
      }
      continue;
    }
    latest.set(sku, {
      sku, market: item.market, market_product_key: keyOf(item),
      business_unit: item.business_unit, category: item.category,
      product_family: item.product_family, model: item.model,
      name: item.name, brand: item.brand,
      variant_attributes: item.variant_attributes || {},
      product_url: item.product_url, source_urls: item.source_urls || [],
      specs: verifiedSpecs, first_seen_at: capturedAt,
      immutable_profile_captured_at: capturedAt
    });
  }
  return [...latest.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

export function hasCommerceEvidence(row) {
  return COMMERCE_FIELDS.some(field => notEmpty(row?.[field]));
}

export function isVerifiedFresh(row, field, at = Date.now(), maxAgeHours = 36) {
  const value = row?.[field];
  const stamp = Date.parse(value || "");
  const time = typeof at === "number" ? at : Date.parse(at);
  return Number.isFinite(stamp) && Number.isFinite(time) && time >= stamp &&
    time - stamp <= maxAgeHours * 3600000;
}
