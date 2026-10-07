# MCP usage

S.com Data Platform exposes its local normalized data marts as a stdio MCP server.

## Start

```bash
npm install
npm run mcp
```

## Primary tools

### list_markets
Configured markets plus targeted crawl coverage and mart counts.

### search_products
Search Product Master by name, model, SKU, category, market, and optional consumer/business audience.

### get_product
Returns a joined product object:
- Product Master
- Product Specs
- Market Offer
- Commerce Options

### get_product_specs
Structured technical facts. An empty specs array means the current source did not expose normalized structured specs yet.

### get_market_offer
Current price, currency, availability, purchase URL, and observed promotion evidence.

### get_commerce_options
Observed:
- financing / installments
- subscription / rental
- trade-in
- Samsung Care+ / protection
- delivery
- installation
- haul-away / recycling
- bundles / add-ons
- rewards / membership

Heuristic observations include evidence snippets and source URLs.

### compare_market_offers
Finds the best product match for the same query in multiple markets and returns current offer + commerce options.

### get_product_history
Returns product, market-offer, and commerce-option versions.

### get_support_resources
Searches support/manual/download/warranty/repair resources.

### browse_category
Returns matching taxonomy paths and products.

## Fallback tools

### search_scom
Raw normalized source-page search. Prefer mart tools for product and commerce questions.

### get_page
Exact normalized source-page retrieval for diagnostics/evidence.

## Important interpretation rule

No observed commerce option does **not** mean the option is definitively unavailable. It means the currently crawled source did not provide evidence that the extractor normalized.
