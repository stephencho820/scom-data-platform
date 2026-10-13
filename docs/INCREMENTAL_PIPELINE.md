# Incremental collection and mart lifecycle

This pipeline is **discovery-first but update-only-by-domain**. It does not claim to have finished the Samsung.com catalog and does not equate `sync success` with chatbot `READY`.

## Sources and refresh cadence

| Domain | Default revisit | Durable storage | Change rule |
| --- | --- | --- | --- |
| SKU identity and technical specifications | Once for initial enrichment; low-frequency 90-day verification of captured product pages | `sku_registry.jsonl`, `product_specs.jsonl` | Never regress populated specs to a shorter/empty scrape; promote a previously empty SKU profile only after evidence exists |
| Product descriptions, manuals, FAQs, policy pages | 7 days for known support URLs | `support_resources.jsonl`, `pages.jsonl` | Only persist new semantic content; retain source/capture evidence |
| Product price, promotions, eligibility | 24 hours for buy pages, plus official KR catalog checks on every crawl | `market_offers.jsonl` and price history | Only update a value with newly observed SKU-specific evidence; a cached page is not a fresh verification |
| Commerce options | On captured commerce page; last-verified separately | `commerce_options.jsonl` and commerce history | Do not erase known options with an empty category card |
| Delivery availability, checkout quote, personalized coupons, account inventory | On-demand via official authenticated integrations (not provided by scraper) | No authoritative offline mart | Never invent or imply live entitlement |

The scheduler prioritizes due commerce checks without starving newly discovered URLs, then checks the other due pages. Configuration: `config/refresh-policy.json`. Each URL that fails enters an exponential retry cooldown (1h, 2h, 4h ... capped at 7 days), persisted in `data/state/{market}/url_failures.json`. Successful URL checks clear the backoff. The previous `data/current` and marts remain available on transient failures, but commerce is **not** presented as verified when it is stale or its lifecycle becomes unverified.

This still requires HTTP/HTML fetches to **detect** changes if Samsung provides no approved change feed or public field-specific API. Incremental refers to choosing due URLs, parsing relevant domains, and persisting semantic changes, not a guarantee that no HTTP request will occur for unchanged records.

## Identity model and special cases

Identity is per market and public SKU: `market + SKU`. The repository stores marts separately per market; `market_product_key` equals canonical SKU **within** that market. Business units: DA, VD, MX, HARMAN, OTHER. Family/model-level spec normalization is a follow-up optimization; avoid unsafe merging of specs between variants.

When an SKU disappears from a verified source, retain its historical identity/specs, but suppress current offers. When a catalog source fails, treat its lifecycle as unverified; never conclude that the disappeared SKUs are discontinued. The SKU registry is append/enrich-only. No product with empty specs should pass `current_specs_complete`.

## Data contracts

- `data/marts/{market}/sku_registry.jsonl`: accumulated first-seen identity and available immutable specs; empty spec placeholders can be populated later.
- `data/marts/{market}/product_master.jsonl`: current known identities and lifecycle. Unchanged records retain their previous `captured_at`; most recent verification lives elsewhere.
- `data/marts/{market}/product_specs.jsonl`: verified specs; an empty/shorter new scrape cannot erase stronger previous evidence.
- `data/marts/{market}/market_offers.jsonl`: latest verified semantic offer value; `fingerprint` excludes volatile capture timestamps.
- `data/marts/{market}/commerce_options.jsonl`: latest observed options, updated only if there is fresh product-specific evidence.
- `data/marts/{market}/refresh_state.jsonl`: `offer_checked_at` and `commerce_checked_at` per SKU; *last checked* is not the same as *last changed*.
- `data/marts/{market}/incremental_report.json`: per-run counts for new SKUs, updated specs, changed prices/options, and completed validations.
- `data/marts/{market}/chatbot_readiness.json`: independent strict product completeness and quality gates; never auto-updated to TRUE merely because incremental crawl completed.

The MCP gates offers to verified current sellable SKUs with an official price check within 36h; commerce options require evidence within 14 days (336h). The age limits are configurable in `config/refresh-policy.json`; the MCP must reject unknown/stale facts rather than falling back to old price.

## Local execution and verification

```bash
npm install
node --test test/*.test.mjs
node scripts/crawl.mjs --market=kr --batch=20 --spec-batch=8
npm run mcp
```

The scheduled `.github/workflows/crawl.yml` runs KR daily; a push to `main` changing scripts/config also triggers a small crawl batch. The free-infrastructure goal favors an initial 24h offer-refresh interval; do not claim subhour real-time pricing. The homepage's **Incremental data sync** panel is updated after a completed run and remains visually separate from the **READY** quality gate.

## Open issues / next milestones

1. Recover failed KR sources (including tablets, buds, rings, projectors, audio) and independently certify expected SKU/variant coverage.
2. Reconcile Samsung Support/manual/FAQ records to concrete model/SKU and fill legacy catalog history.
3. Move common model specs into model-level reusable documents *after* proving identical values across sellable variants.
4. Add approved, low-latency commerce/stock integrations before promoting price checks to near-real-time guarantees.
5. Measure crawl runtime and GitHub Actions quota before increasing frequency or expanding countries.

Never assert chatbot READY while any required gate is FALSE.
