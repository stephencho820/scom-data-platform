import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, copyFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

test("status is populated at build time and never depends on browser fetch to stop loading", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "scom-status-"));
  const output = path.join(dir, "status.html");
  try {
    await copyFile("web/status.html", output);
    execFileSync(process.execPath, ["scripts/build-status-page.mjs", output], {stdio:"pipe"});
    const html = await readFile(output,"utf8");
    const readiness = JSON.parse(await readFile("data/marts/kr/chatbot_readiness.json","utf8"));
    assert.match(html, /id="status-bootstrap"/);
    assert.match(html, /id="status-pill"[^>]*>NOT READY</);
    assert.ok(html.includes(String(readiness.counts.current_skus)));
    assert.ok(html.includes("하만 SKU"));
    assert.ok(!html.includes("데이터 상태 확인 중…"));
    assert.ok(!html.includes('data-i18n="statusLoading"'));
    assert.match(html, /id="status-categories"[^>]*>\s*<tr>/);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test("HARMAN is registered as an official KR catalog source, not misclassified as VD", async () => {
  const cfg=JSON.parse(await readFile("config/catalog-sources.json","utf8"));
  const source=cfg.markets.kr.find(row=>row.id==="harman-lifestyle-audio");
  assert.ok(source);
  assert.equal(source.business_unit,"HARMAN");
  assert.equal(new URL(source.url).hostname,"www.samsung.com");
  const rx=new RegExp("^(?:"+source.model_pattern+")$","i");
  for(const sku of ["JBLPULSE6BLK","HKOS9GRYAS","JBLGO5BLK","JBLLIVE680NCBLK"])assert.ok(rx.test(sku),sku);
  const paths=JSON.parse(await readFile("config/crawl-scope.json","utf8")).includePathPatterns;
  assert.ok(paths.includes("/harman-lifestyle-audio/"));
  const crawler=await readFile("scripts/crawl.mjs","utf8");
  assert.ok(crawler.includes("source.id === product?.catalog_source_id"));
  assert.ok(crawler.includes("sourcePattern"));
});

test("browser status always has a bounded refresh and a published fallback",async()=>{
 const js=await readFile("web/status.js","utf8");
 assert.ok(js.includes("status-bootstrap"));
 assert.ok(js.includes("AbortController"));
 assert.ok(js.includes("refreshSnapshot()"));
 assert.ok(js.includes("if (dataset) render()"));
});
