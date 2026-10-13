import test from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,rm,mkdtemp} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import os from "node:os";
import path from "node:path";
import {buildCatalog,definition,inspectDataset} from "../scripts/build-data-catalog.mjs";

test("data catalog describes actual 9 KR JSONL marts and 3 history datasets",async()=>{
 const catalog=await buildCatalog(process.cwd());
 assert.equal(catalog.schema_version,1);
 assert.equal(catalog.market,"kr");
 assert.equal(catalog.tables.length,12);
 assert.equal(definition.length,12);
 assert.ok(catalog.snapshot_at);
 for(const name of ["sku_registry","product_master","product_specs","market_offers","commerce_options","support_resources","taxonomy","catalog_current","refresh_state","history_products","history_offers","history_commerce_options"]){
  const row=catalog.tables.find(x=>x.id===name);
  assert.ok(row,"Missing table: "+name);
  assert.ok(row.row_count>=0);
  assert.ok(row.file.endsWith(".jsonl"));
  assert.ok(row.pk);
  assert.ok(row.title.kr && row.title.us && row.desc.kr && row.desc.us);
  assert.ok(row.columns.length>0 || row.row_count===0);
 }
 assert.equal(catalog.realtime.integrated,false);
 assert.equal(catalog.readiness.ready,false); // This project's strict gates remain unchanged.
});
test("manifest reflects real source counts and reports missing specs rather than pretending rows are complete",async()=>{
 const catalog=await buildCatalog(process.cwd());
 const specs=catalog.tables.find(x=>x.id==="product_specs");
 const master=catalog.tables.find(x=>x.id==="product_master");
 const offers=catalog.tables.find(x=>x.id==="market_offers");
 const raw=await readFile("data/marts/kr/product_specs.jsonl","utf8");
 assert.equal(specs.row_count,raw.split(/\r?\n/).filter(Boolean).length);
 assert.equal(master.row_count,catalog.readiness.counts.sku_registry);
 assert.ok(specs.row_count>catalog.readiness.counts.current_skus_with_specs);
 assert.ok(specs.columns.some(x=>x.name==="specs" && x.populated<specs.row_count));
 assert.ok(specs.columns.some(x=>x.name==="specs[].value"));
 assert.ok(offers.columns.some(x=>x.name==="price"));
 assert.ok(catalog.reports.length>=4);
});
test("schema detector retains nested values and correct null / empty-array ratios",()=>{
 const result=inspectDataset([{id:"1",specs:[],checked:null},{id:"2",specs:[{name:"Display",value:"4K"}],checked:"2026-10-13"}],{id:"demo"});
 assert.equal(result.row_count,2);
 const specs=result.columns.find(c=>c.name==="specs");
 assert.equal(specs.present,2);assert.equal(specs.populated,1);assert.equal(specs.type,"array");
 const nested=result.columns.find(c=>c.name==="specs[].value");
 assert.equal(nested.populated,1);
 const check=result.columns.find(c=>c.name==="checked");
 assert.equal(check.populated,1);
});
test("static catalog has accessible main navigation, bilingual UI and source-only samples",async()=>{
 const [html,code,css,site,workflow]=await Promise.all([
  readFile("web/catalog.html","utf8"),readFile("web/catalog.js","utf8"),
  readFile("web/catalog.css","utf8"),readFile("web/site.js","utf8"),
  readFile(".github/workflows/pages.yml","utf8")
 ]);
 assert.ok(html.includes('href="./status.html" data-i18n="navStatus"'));
 assert.ok(html.includes('href="./catalog.html" data-i18n="navCatalog"'));
 assert.ok(html.includes('href="./explorer.html" data-i18n="navExplorer"'));
 assert.ok(html.includes('id="catalog-table-list"'));
 assert.ok(html.includes('id="catalog-detail"'));
 assert.ok(site.includes('navStatus:"데이터 현황"'));
 assert.ok(site.includes('navStatus:"Data status"'));
 assert.ok(code.includes("document.createElement"));
 assert.ok(code.includes("textContent"));
 assert.ok(!code.includes("innerHTML"));
 assert.ok(code.includes("AbortController"));
 assert.ok(css.includes("@media(max-width:600px)"));
 assert.ok(workflow.includes("node scripts/build-data-catalog.mjs dist/data/catalog/kr.json dist/catalog.html"));
});
test("deployment builds catalog manifest and embeds escaped JSON bootstrap",async()=>{
 const tmp=await mkdtemp(path.join(os.tmpdir(),"scom-catalog-"));
 const output=path.join(tmp,"kr.json"),htmlFile=path.join(tmp,"catalog.html");
 try{
  await writeFile(htmlFile,await readFile("web/catalog.html","utf8"));
  execFileSync(process.execPath,["scripts/build-data-catalog.mjs",output,htmlFile],{stdio:"pipe"});
  const manifest=JSON.parse(await readFile(output,"utf8"));
  const embedded=await readFile(htmlFile,"utf8");
  const match=embedded.match(/<script type="application\/json" id="catalog-bootstrap">([^<]+)<\/script>/);
  assert.ok(match,"Bootstrap script must render");
  const parsed=JSON.parse(match[1]);
  assert.equal(parsed.snapshot_at,manifest.snapshot_at);
  assert.equal(parsed.tables.length,manifest.tables.length);
  assert.ok(!match[1].includes("<"),"JSON script must be escaped");
 }finally{await rm(tmp,{recursive:true,force:true});}
});
