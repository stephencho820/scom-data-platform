import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const index = await readFile("web/index.html", "utf8");
const status = await readFile("web/status.html", "utf8");
const explorer = await readFile("web/explorer.html", "utf8");
const catalog = await readFile("web/catalog.html", "utf8");
const site = await readFile("web/site.js", "utf8");
const poc = await readFile("web/poc.js", "utf8");
const app = await readFile("web/app.js", "utf8");

test("home prioritizes AI-ready schema, data and MCP",()=>{
 const nav=index.match(/<nav class="main-nav"[\s\S]*?<\/nav>/)?.[0]||"";
 assert.equal((nav.match(/<a\s/g)||[]).length,4);
 assert.ok(nav.includes('href="./registry.html"'));
 assert.ok(nav.includes('href="./ai-data.html"'));
 assert.ok(nav.includes('href="./#connect"'));
 assert.ok(index.includes('class="ai-steps-grid"'));
 assert.ok(index.indexOf('class="ai-steps-grid"')<index.indexOf('id="connect"'));
 assert.ok(!index.includes('id="lifecycle"'));
});

test("KR/US translations exist for all shared page labels", () => {
  const keys = new Set([index, status, explorer, catalog].join("").matchAll(/data-i18n="([A-Za-z0-9_]+)"/g));
  for (const match of keys) {
    assert.ok(site.includes(match[1]+":"), "Missing translation: "+match[1]);
  }
  for (const language of ["kr", "us"]) assert.ok(site.includes("  "+language+": {"), "Missing "+language);
});

test("real-time inventory and delivery remain explicitly unsupported",()=>{
 assert.ok(poc.includes("Integration required: authorized inventory / delivery API"));
 assert.ok(index.includes("MCP"));
 assert.ok(index.includes("AI-Ready"));
});

test("explorer price requires fresh verified, sellable source evidence", () => {
  assert.ok(app.includes("refresh_state.jsonl"));
  assert.ok(app.includes('product.lifecycle_status === "current_sellable"'));
  assert.ok(app.includes("36 * 3600000"));
});

test("all published POC assets exist", async () => {
  await Promise.all(["web/landing.css","web/site.js","web/poc.js","scripts/build-demo-data.mjs","web/status.html","web/status.js","web/explorer.html","web/explorer.css","web/catalog.html","web/catalog.css","web/catalog.js"].map(file=>access(file)));
});
