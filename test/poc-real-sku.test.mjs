import test from "node:test";
import assert from "node:assert/strict";
import { buildDemoData } from "../scripts/build-demo-data.mjs";
import { execFileSync } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const base={market_product_key:"SM-F966NDBPKOO",sku:"SM-F966NDBPKOO",name:"Sample Galaxy",model:"SM-F966NDBPKOO",market:"kr",
  business_unit:"MX",category:"smartphones",product_url:"https://www.samsung.com/sec/smartphones/a/SM-F966NDBPKOO/",
  lifecycle_status:"current_sellable",commerce_eligible:true};
const offer={market_product_key:base.market_product_key,price:"1234000",currency:"KRW",
  purchase_url:base.product_url,captured_at:"2026-10-13T09:00:00.000Z"};
const refresh={market_product_key:base.market_product_key,offer_checked_at:"2026-10-13T09:40:00.000Z"};
function build(overrides={}){return buildDemoData({master:[base],specs:[{market_product_key:base.market_product_key,
  specs:[{name:"Display",value:"7.6",unit:"inches"}],source_url:base.product_url}],
  offers:[offer],refresh:[refresh],support:[],readiness:{ready:false,generated_at:"2026-10-13T09:41:00.000Z"},...overrides});}

test("real-SKU POC includes actual source-linked identity, spec and verified offer fields",()=>{
 const data=build();
 assert.equal(data.stats.sku_count,1);
 const item=data.products[0];
 assert.equal(item.bu,"MX");
 assert.equal(item.specs[0].value,"7.6");
 assert.equal(item.offer.price,"1234000");
 assert.equal(item.offer.checked_at,refresh.offer_checked_at);
 assert.equal(data.stats.ready,false);
});

test("stale/non-sellable/orphan/invalid-source offers are never published as usable",()=>{
 const notSellable={...base,lifecycle_status:"current_unavailable",commerce_eligible:false};
 assert.equal(build({master:[notSellable]}).products[0].offer,null);
 assert.equal(build({offers:[{...offer,price:"0"}]}).products[0].offer,null);
 assert.equal(build({offers:[{...offer,purchase_url:"https://untrusted.example.com/"}]}).products[0].offer,null);
 assert.equal(build({refresh:[]}).products[0].offer,null);
 assert.equal(build({master:[{...base,product_url:"javascript:alert(1)"}]}).products.length,0);
});

test("generic support URLs do not become false SKU-specific manual evidence",()=>{
 const support=[{title:"General support",source_url:"https://www.samsung.com/sec/support/"}];
 assert.equal(build({support}).products[0].support.length,0);
 const linked=[{...support[0],sku:base.sku}];
 assert.equal(build({support:linked}).products[0].support.length,1);
});

test("published actual KR demo includes all four BU and clearly labels missing specs",async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"scom-poc-"));
 const file=path.join(dir,"kr.json");
 try{
  execFileSync(process.execPath,["scripts/build-demo-data.mjs",file],{stdio:"pipe"});
  const doc=JSON.parse(await readFile(file,"utf8"));
  assert.equal(doc.schema_version,1);
  assert.equal(doc.market,"kr");
  assert.ok(doc.products.length>100,"Published dataset should contain real KR SKUs");
  for(const bu of ["DA","VD","MX","HARMAN"])assert.ok(doc.products.some(x=>x.bu===bu),bu+" not represented");
  assert.ok(doc.products.some(x=>x.bu==="MX"&&x.specs.length>0),"Need an actual structured-spec example");
  assert.ok(doc.products.some(x=>x.bu==="HARMAN"&&x.specs.length===0),"Need truthful HARMAN gap");
  assert.ok(doc.products.every(x=>x.source_url.startsWith("https://www.samsung.com/")));
  assert.ok(doc.products.every(x=>!x.offer || x.offer.source_url.startsWith("https://www.samsung.com/")));
 }finally{await rm(dir,{force:true,recursive:true});}
});

test("AI-ready portal does not expose removed demo; legacy POC still gates prices",async()=>{
 const js=await readFile("web/poc.js","utf8");
 const html=await readFile("web/index.html","utf8");
 assert.ok(html.includes('class="ai-steps-grid"'));
 assert.ok(html.includes('href="./registry.html"'));
 assert.ok(html.includes('href="./ai-data.html"'));
 assert.ok(!html.includes('demo-sku-select'));
 assert.ok(js.includes("now-stamp<=36*3600000"));
 assert.ok(js.includes("now>=stamp"));
 assert.ok(js.includes("authorized inventory / delivery API"));
});
