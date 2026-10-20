# Customer Shopping AI Agent — POC 1 (KR / MX)

## Purpose

Build a customer-facing shopping assistant for Samsung.com visitors. It is NOT a business intelligence agent. Historical price/sales analysis, arbitrary NL2SQL, BI marts and customer-facing historical reporting are out of scope.

Flow: Customer intent → exact market SKU → collected facts and provenance → validated read-only tools → LLM response.

The existing GitHub JSONL data marts and incremental crawler are the starting point. Supabase or Vercel are not required for the local first proof.

## Scope

- Market: KR first; prioritize MX smartphones (Galaxy S / Z).
- Intents: find currently sellable products, read specs, retrieve current verified observed price, compare 2–4 market SKUs, recommend by filters **when collected facts allow**.
- Four tools: search_products, get_product_specs, get_product_price, compare_products.
- Not in scope: arbitrary SQL generation, FAQ/RAG (next phase), personal orders, stock, delivery, payment and unseen promotions.

## Actual audit baseline (checked October 20, 2026)

From data/marts/kr/chatbot_readiness.json (generated 2026-10-19T21:34:12Z):

| Measure | Observed |
|---|---:|
| Current SKUs | 1,113 |
| Current SKUs with structured specs | 123 |
| Current SKUs linked to support | 0 |
| Overall chatbot readiness | **false** |

Configured KR smartphone catalog source reports 90 observed SKUs. Configured-source coverage does not prove every Samsung.com SKU has been discovered.

## Data interpretation

| Data | Mart | Customer response policy |
|---|---|---|
| Product/SKU | product_master | Search purchase candidates only among source-linked current_sellable SKUs. |
| Specifications | product_specs | Return captured key/value facts with exact SKU and official URL. Missing facts remain unknown. |
| Current observed price | market_offers + refresh_state | Quote only for sellable SKUs, official source URL, positive numeric value, and recent verification within TTL. |
| Official MSRP/list price | Not separately normalized yet | Never label an observed offer as confirmed official list price. |
| Live stock, delivery, orders | Future authorized commerce APIs | No real-time promise in this POC. |
| FAQ and policies | Future knowledge index | Not yet implemented. |

Legacy history files may remain for ingestion reconciliation, but are not exposed to this customer Agent for analytics.

## Run the local Agent

Node.js 20+ and an OpenAI API key with Responses API access are required. Do not commit keys.

1. npm install
2. Set OPENAI_API_KEY in your shell environment.
3. Optionally set OPENAI_MODEL (default gpt-5.5).
4. npm run agent:cli

Sample prompts:
- 현재 판매 중인 갤럭시 스마트폰 찾아줘.
- 갤럭시 플립의 SKU를 찾아서 스펙을 알려줘.
- 이 SKU 둘을 비교해줘: [SKU A] [SKU B].
- 150만원 이하에 배터리 5000mAh 이상인 스마트폰을 찾아줘.

This is an interactive local CLI, NOT a deployed customer chatbot. GitHub Pages is static; it cannot securely host the API key. A separately protected server backend is needed before public deployment.

## Architecture

Samsung.com KR → existing crawler/marts → customer-tools.mjs (four read-only tools) → Responses API agent → grounded Korean answer.

Customer tools can later be reused through MCP and through a secured application API.

## POC acceptance and next steps

1. Execute regression tests for source URLs, SKU identity, lifecycle and price freshness.
2. Expand structured Galaxy smartphone spec coverage, measure completeness (rather than record counts).
3. Distinguish list price from observed sales price in the source schema, only with verifiable source semantics.
4. Evaluate the Agent on a set of real customer intents and measure grounded answer accuracy.
5. Add a protected backend and a product-card chat UI (never embed OPENAI_API_KEY in browser code).
6. Add FAQ/description knowledge search and additional countries only after basic data gates pass.

Disclaimer: independent community proof of concept; not an official Samsung service.
