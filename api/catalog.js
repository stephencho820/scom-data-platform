import { createCustomerTools } from "../src/agent/customer-tools.mjs";

const customerTools = createCustomerTools();
const noCache = (res) => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
};
export default async function handler(req, res) {
  noCache(res);
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const url = new URL(req.url, "https://example.invalid");
  const params = url.searchParams;
  if (params.get("status") === "1") return res.status(200).json({
    online: true, market: "kr", ai_configured: Boolean(process.env.OPENAI_API_KEY),
    source: "Existing Samsung.com collected KR data marts",
    supports_live_inventory: false,
    note: "A functioning endpoint is not proof of complete or current product data."
  });
  try {
    const query = String(params.get("q") || "갤럭시").slice(0, 100);
    const category = params.get("category") || "smartphones";
    const limit = Math.min(20, Math.max(1, Number(params.get("limit")) || 12));
    const result = await customerTools.search_products({
      market: "kr", query, category, limit
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("catalog lookup error", error.message);
    return res.status(500).json({ error: "catalog_unavailable" });
  }
}
