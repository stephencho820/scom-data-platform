/**
 * Local, read-only Samsung.com customer shopping agent POC.
 * Run with OPENAI_API_KEY=... npm run agent:cli
 * Actual products, specifications and prices come exclusively from the marts.
 */
import { createInterface } from "node:readline/promises";
import process from "node:process";
import { createCustomerTools } from "./customer-tools.mjs";

const tools = createCustomerTools();
const market = { type: "string", enum: ["kr"] };
const nullable = schema => ({ anyOf: [schema, { type: "null" }] });
const params = properties => ({
  type: "object", properties,
  required: Object.keys(properties),
  additionalProperties: false
});
const definitions = [
  {
    type: "function", name: "search_products", strict: true,
    description: "Search currently sellable KR Samsung.com SKUs. Optional filters require evidence; missing price/spec excludes the SKU from matching numeric filters.",
    parameters: params({
      market, query: { type: "string" },
      category: nullable({ type: "string" }),
      max_price: nullable({ type: "number", minimum: 0 }),
      min_battery_mah: nullable({ type: "number", minimum: 0 }),
      limit: { type: "integer", minimum: 1, maximum: 30 }
    })
  },
  {
    type: "function", name: "get_product_specs", strict: true,
    description: "Get exact-SKU collected specification facts; results may be incomplete or unverified.",
    parameters: params({ market, sku: { type: "string" } })
  },
  {
    type: "function", name: "get_product_price", strict: true,
    description: "Get exact-SKU recently verified observed Samsung.com offer, not confirmed MSRP. Stale or unavailable prices are withheld.",
    parameters: params({ market, sku: { type: "string" } })
  },
  {
    type: "function", name: "compare_products", strict: true,
    description: "Compare 2 to 4 exact market SKUs, preserving missing fields and provenance.",
    parameters: params({
      market, skus: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 }
    })
  }
];

const INSTRUCTIONS = [
  "You are a Korean shopping assistant POC for Samsung.com South Korea customers.",
  "Use only tool output for any product facts, current prices, availability or comparisons.",
  "Always search for exact SKU candidates before answering product-specific questions without a SKU.",
  "Never invent a product, SKU, specification, amount, currency, discount or stock status.",
  "Collected_unverified specifications have source evidence but are not completeness-certified.",
  "A verified_recently observed site price is NOT necessarily official MSRP; distinguish clearly.",
  "Do not claim that a missing or stale price is zero or that a product is unavailable.",
  "Show an official Samsung.com product URL where available.",
  "Do not promise stock, delivery, orders or payment capabilities: authorized live APIs are not connected.",
  "This is a partial KR catalog POC, not a complete Samsung catalog.",
  "Answer concisely in Korean; explicitly disclose missing or uncertain facts."
].join(" ");

async function send(body) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error("Model API failed (" + response.status + "): " + error.slice(0, 250));
  }
  return response.json();
}

export async function askShoppingAgent(question, { model = process.env.OPENAI_MODEL || "gpt-5.5",
  callModel = send, toolset = tools } = {}) {
  if (!String(question || "").trim()) return "질문을 입력해 주세요.";
  const input = [{ role: "user", content: String(question).slice(0, 2000) }];
  for (let round = 0; round < 6; round++) {
    const response = await callModel({
      model, instructions: INSTRUCTIONS, input,
      tools: definitions, tool_choice: round === 0 ? "required" : "auto",
      parallel_tool_calls: false, store: false, max_output_tokens: 1000
    });
    input.push(...(response.output || []));
    const calls = (response.output || []).filter(item => item.type === "function_call");
    if (!calls.length) {
      return response.output_text ||
        (response.output || []).filter(item => item.type === "message")
          .flatMap(item => item.content || []).filter(item => item.type === "output_text")
          .map(item => item.text).join("\n") ||
        "확인 가능한 답변이 없습니다.";
    }
    for (const call of calls) {
      let result;
      try {
        if (!Object.hasOwn(toolset, call.name)) throw new Error("unsupported_tool");
        const args = JSON.parse(call.arguments || "{}");
        result = await toolset[call.name](args);
      } catch (error) {
        result = { status: "tool_error", message: error.message };
      }
      input.push({ type: "function_call_output", call_id: call.call_id,
        output: JSON.stringify(result) });
    }
  }
  return "현재 요청을 검증된 정보로 완료하지 못했습니다. 질문을 조금 더 구체적으로 입력해 주세요.";
}

const startedDirectly = process.argv[1] && 
  new URL(import.meta.url).pathname === new URL("file://" + process.argv[1]).pathname;
if (startedDirectly) {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY 환경변수가 필요합니다. API 키는 GitHub에 커밋하지 마세요.");
    process.exitCode = 1;
  } else {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    console.log("Samsung.com Shopping Agent POC (KR / MX 우선) — 종료: exit");
    try {
      while (true) {
        const question = (await prompt.question("\n질문> ")).trim();
        if (["exit", "quit"].includes(question.toLowerCase())) break;
        if (!question) continue;
        try { console.log("\n" + await askShoppingAgent(question)); }
        catch (error) { console.error("요청 실패:", error.message); }
      }
    } finally { prompt.close(); }
  }
}
