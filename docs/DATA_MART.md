# S.com Data Marts

S.com Data Platform is not a general-purpose Samsung.com mirror. Sitemap inventory is used for discovery, but only pages that can populate agent-facing data marts should be fetched and retained.

## Data mart contract

### 1. Product Master
Stable product identity within a market.

Core fields:
- market_product_key
- market
- audience: consumer | business | unknown
- name
- sku
- model
- brand
- category_path
- product_url
- source_urls
- captured_at

### 2. Product Specs
Structured technical facts for comparison.

Core fields:
- market_product_key
- market
- sku / model
- specs: normalized key/value/unit entries
- source_url
- captured_at

Specs should come from structured data first. Samsung-specific extractors can expand coverage later.

### 3. Market Offer
The purchasable state of a product in a market at a point in time.

Core fields:
- market_product_key
- market
- price
- currency
- availability
- purchase_url
- promotions
- captured_at
- fingerprint

History is retained on meaningful change.

### 4. Commerce Options
Purchase and post-purchase choices that can vary by product, market, and time.

Option families:
- purchase_methods: outright, installments, financing, carrier finance, lease
- subscription: product subscription / rental / upgrade programs
- trade_in
- protection: Samsung Care+, extended warranty, theft/loss where exposed
- delivery
- installation
- haul_away / recycling / removal
- bundles and add-ons
- membership / rewards / business volume purchase programs

Each option stores:
- type
- available
- label
- details when safely extractable
- evidence snippet
- confidence: high | medium | low
- applicability: product | conditional | page
- source_url
- captured_at

Evidence is required for heuristic extraction so an agent can distinguish an observed page claim from a fully normalized contractual term. Navigation/footer mentions alone must not be treated as a product option; the extractor should require transactional or eligibility wording.

### 5. Support Resources
Product or category-linked public support information.

Examples:
- product support page
- manuals
- software/downloads
- warranty
- repair/service
- FAQ/help

### 6. Taxonomy
Market-local category hierarchy derived from product/category URLs and page context.

Examples:
- Mobile > Smartphones > Galaxy S
- TV & AV > OLED
- Appliances > Refrigerators

## History policy

Retain history for fields that change and affect a user decision:
1. price
2. availability
3. promotion
4. trade-in
5. subscription / financing
6. Samsung Care+ and protection
7. delivery / installation / haul-away
8. important specs
9. product identity and market availability

Do not retain full page-text history.

## Crawl policy

Full sitemap inventory is discovery metadata only.

Target crawl candidates should be limited to pages likely to populate a mart:
- product PDPs and buy/configurator pages
- product listing/category pages when they expose structured products
- product support/manual/download pages
- commerce/service policy pages relevant to buying, delivery, installation, trade-in, protection, subscription, recycling, or haul-away

Low-value pages should not be crawled merely because they exist in a sitemap:
- newsroom/editorial archives
- corporate/about pages
- sustainability articles
- legal/footer-only pages
- account/cart/login flows
- generic campaign pages without product or commerce facts

## Agent-facing MCP model

Primary tools should answer product questions from marts, not by searching arbitrary page text.

Recommended interface:
- search_products
- get_product
- get_product_specs
- get_market_offer
- get_commerce_options
- compare_market_offers
- get_product_history
- get_support_resources
- browse_category

Generic source-page search remains available as a diagnostic/fallback tool.

## Source-of-truth rule

Every normalized fact must preserve:
- market
- captured_at
- source_url

Heuristically extracted commerce facts additionally preserve an evidence snippet.
