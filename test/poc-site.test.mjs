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

test("POC home keeps four data lifecycles and exposes health, catalog, and explorer navigation", () => {
  assert.equal((index.match(/class="type-card /g) || []).length, 4);
  assert.equal((index.match(/<button class="demo-option/g) || []).length, 4);
  const nav = index.match(/<nav class="main-nav"[\s\S]*?<\/nav>/)?.[0] || "";
  assert.equal((nav.match(/<a\s/g) || []).length, 6);
  assert.ok(nav.includes('href="./status.html"'));
  assert.ok(nav.includes('href="./catalog.html"'));
  assert.ok(nav.includes('href="./registry.html"'));
  assert.ok(nav.includes('href="./explorer.html"'));
  assert.ok(index.indexOf('id="lifecycle"') < index.indexOf('id="demo"'));
  assert.ok(index.indexOf('id="demo"') < index.indexOf('id="connect"'));
  assert.ok(index.includes("status.html"));
  assert.ok(index.includes("explorer.html"));
});

test("KR/US translations exist for all shared page labels", () => {
  const keys = new Set([index, status, explorer, catalog].join("").matchAll(/data-i18n="([A-Za-z0-9_]+)"/g));
  for (const match of keys) {
    assert.ok(site.includes(match[1]+":"), "Missing translation: "+match[1]);
  }
  for (const language of ["kr", "us"]) assert.ok(site.includes("  "+language+": {"), "Missing "+language);
});

test("D route is described as an integration requirement, not a live MCP tool", () => {
  assert.ok(poc.includes("Integration required: authorized inventory / delivery API"));
  assert.ok(index.includes("실제 수집 마트"));
  assert.ok(index.includes("MCP"));
});

test("explorer price requires fresh verified, sellable source evidence", () => {
  assert.ok(app.includes("refresh_state.jsonl"));
  assert.ok(app.includes('product.lifecycle_status === "current_sellable"'));
  assert.ok(app.includes("36 * 3600000"));
});

test("all published POC assets exist", async () => {
  await Promise.all(["web/landing.css","web/site.js","web/poc.js","scripts/build-demo-data.mjs","web/status.html","web/status.js","web/explorer.html","web/explorer.css","web/catalog.html","web/catalog.css","web/catalog.js"].map(file=>access(file)));
});
