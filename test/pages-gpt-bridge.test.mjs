import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { backendUrl, askRemoteAgent } from "../web/agent-backend.js";

test("GitHub Pages defaults to existing rule-based demo until backend URL is explicitly configured", async () => {
  assert.equal(backendUrl(), null);
  const js = await readFile("web/agent.js", "utf8");
  assert.match(js, /usesRemote\s*\?/);
  assert.match(js, /runDemoQuestion/);
  assert.match(js, /askRemoteAgent/);
  const page = await readFile("web/agent.html", "utf8");
  assert.match(page, /id="backend-status"/);
  assert.match(page, /GitHub Pages/);
  assert.doesNotMatch(js, /Bearer sk-/);
});
test("a missing backend URL does not ask for a secret or send a request", async () => {
  await assert.rejects(
    () => askRemoteAgent("갤럭시", [], { askCode: () => {
      throw Error("access code should not be prompted when disabled");
    } }),
    /backend_not_configured/
  );
});
test("repository contains only public endpoint config and server-side secret references", async () => {
  const client = await readFile("web/agent-config.js", "utf8");
  assert.match(client, /SHOPPING_AGENT_BACKEND_URL = ""/);
  assert.doesNotMatch(client, /sk-[a-zA-Z0-9]{16,}/);
  const edge = await readFile("supabase/functions/shopping-agent/index.ts", "utf8");
  assert.match(edge, /Deno\.env\.get\("OPENAI_API_KEY"\)/);
  assert.match(edge, /SHOPPING_AGENT_ACCESS_CODE/);
  assert.match(edge, /openai\.com\/v1\/responses/);
  assert.match(edge, /MAX_PRICE_AGE_MS = 36/);
  assert.match(edge, /source_linked|source_url/);
  assert.match((await readFile("supabase/config.toml","utf8")), /verify_jwt = false/);
});
