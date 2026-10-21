import { askShoppingAgent } from "../src/agent/cli.mjs";

const isObject = value => value && typeof value === "object" && !Array.isArray(value);
const validOrigin = req => {
  // Same-origin browser requests only. This is not a substitute for
  // deployment protection / rate limits in a public launch.
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const expected = req.headers["x-forwarded-host"] || req.headers.host;
    return originUrl.protocol === "https:" && originUrl.host === expected;
  } catch { return false; }
};
function cardsFromEvent(event) {
  const result = event.result;
  if (!isObject(result)) return [];
  if (Array.isArray(result.products)) return result.products;
  if (isObject(result.product)) return [result.product];
  if (typeof result.sku === "string") return [{ sku: result.sku,
    product_url: result.product_url || result.price?.source_url || null,
    price: result.price || null }];
  return [];
}
function sanitizeCard(item) {
  let productUrl = null;
  try {
    const parsed = new URL(item.product_url || item.source_url || "");
    if (parsed.protocol === "https:" && parsed.host === "www.samsung.com")
      productUrl = parsed.href;
  } catch { /* no verified URL */ }
  if (!productUrl) return null;
  const price = item.price || {};
  return {
    sku: String(item.sku || "").slice(0, 100),
    name: String(item.name || item.sku || "").slice(0, 180),
    model: String(item.model || "").slice(0, 100),
    category: String(item.category || "").slice(0, 60),
    lifecycle: item.lifecycle_status || "unverified",
    product_url: productUrl,
    spec_count: Number(item.spec_count) || (Array.isArray(item.specs) ? item.specs.length : 0),
    spec_status: item.spec_status || null,
    price: price.status === "verified_recently" && price.price_type ===
      "observed_site_price_not_verified_msrp" ?
      { status: "verified_recently", amount: price.amount, currency: price.currency,
        verified_at: price.verified_at, price_type: "observed_site_price_not_verified_msrp" } :
      { status: price.status || "unavailable", amount: null }
  };
}
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!validOrigin(req)) return res.status(403).json({ error: "origin_not_allowed" });
  if (!process.env.OPENAI_API_KEY)
    return res.status(503).json({ error: "agent_not_configured",
      message: "OpenAI API key is not configured on the backend; catalog browsing remains available." });
  const body = isObject(req.body) ? req.body : {};
  const question = String(body.message || "").trim();
  if (!question || question.length > 1000)
    return res.status(400).json({ error: "invalid_question" });
  const history = Array.isArray(body.history) ? body.history.slice(-8).filter(item =>
    isObject(item) && (item.role === "user" || item.role === "assistant") &&
    typeof item.content === "string" && item.content.length <= 1200) : [];
  const events = [];
  try {
    const answer = await askShoppingAgent(question, {
      history, onToolResult: entry => events.push(entry)
    });
    const products = [];
    const seen = new Set();
    for (const event of events) {
      for (const row of cardsFromEvent(event)) {
        const card = sanitizeCard(row);
        if (card && card.sku && !seen.has(card.sku)) {
          seen.add(card.sku); products.push(card);
        }
      }
    }
    return res.status(200).json({
      answer, market: "kr", products: products.slice(0, 4),
      developer: {
        tools: events.map(e => ({
          name: e.name,
          parameters: (() => { try { return JSON.parse(e.arguments || "{}"); } catch { return {}; } })(),
          result_status: e.result?.status || null,
          result_count: e.result?.products?.length || (e.result?.sku ? 1 : 0)
        })),
        provider: "OpenAI Responses API",
        customer_data: "Existing Samsung.com KR captured marts",
        verification: "Partial, source- and freshness-gated"
      }
    });
  } catch (error) {
    console.error("shopping-agent error", error.message);
    return res.status(502).json({ error: "agent_request_failed",
      message: "AI 응답을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }
}
