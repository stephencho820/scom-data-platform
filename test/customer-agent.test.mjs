import test from "node:test";
import assert from "node:assert/strict";
import { askShoppingAgent } from "../src/agent/cli.mjs";

test("agent executes tool calls and returns grounded response", async () => {
  const requests = [];
  const mockModel = async request => {
    requests.push(request);
    if (requests.length === 1) return {
      output: [{ type: "function_call", name: "get_product_price",
        call_id: "call-test", arguments: JSON.stringify({ market: "kr", sku: "SM-TEST" }) }]
    };
    const result = request.input.find(item => item.type === "function_call_output");
    assert.ok(result);
    assert.equal(result.call_id, "call-test");
    assert.equal(JSON.parse(result.output).price.status, "stale_or_unverified");
    return { output: [{ type: "message", content: [{ type: "output_text",
      text: "현재 확인된 가격이 없습니다." }] }] };
  };
  const answer = await askShoppingAgent("테스트 SKU 가격은?", {
    callModel: mockModel,
    toolset: { get_product_price: async () => ({ price: { status: "stale_or_unverified" } }) }
  });
  assert.equal(answer, "현재 확인된 가격이 없습니다.");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].tool_choice, "required");
});

test("agent refuses empty question without calling the model", async () => {
  const answer = await askShoppingAgent("  ", {
    callModel: () => { throw new Error("should not run"); }
  });
  assert.match(answer, /질문/);
});
