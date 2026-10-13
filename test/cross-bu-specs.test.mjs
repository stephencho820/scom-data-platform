import test from "node:test";
import assert from "node:assert/strict";
import {normalizeSpecPair,sanitizePdpPairs,selectCrossBuSpecTargets} from "../src/pipeline/spec-pdp.mjs";

const base={sku:"RF90DB9000APKR",catalog_category:"refrigerators",catalog_source_id:"refrigerators",business_unit:"DA",
  product_detail_url:"https://www.samsung.com/sec/refrigerators/rf90/RF90DB9000APKR/",catalog_source_url:"https://www.samsung.com/sec/refrigerators/",
  lifecycle_status:"current_sellable",specs:[]};
const url=base.product_detail_url;
const declared="Products \nBespoke refrigerator\nSKU RF90DB9000APKR \n Color: white";

test("DA/VD/HARMAN source-backed spec pairs require exact SKU evidence",()=>{
  const sample=[
    {name:"전체 용량",value:"602 L"},
    {name:"제품 크기",value:"912 x 1,853 x 697 mm"},
    {name:"에너지 소비효율 등급",value:"2 등급"},
    {name:"무게",value:"120 kg"},
    {name:"가격",value:"1,200,000원"},
    {name:"브랜드 뉴스",value:"삼성의 모든 것"}
  ];
  const result=sanitizePdpPairs(sample,base.sku,url,declared);
  assert.equal(result.verified,true);
  assert.equal(result.specs.length,4);
  assert.ok(result.specs.every(s=>s.source==="samsung_pdp_verified"));
  assert.equal(sanitizePdpPairs(sample,base.sku,"https://www.samsung.com/sec/refrigerators/rf90/OTHER/",declared).verified,false);
  assert.equal(sanitizePdpPairs(sample,base.sku,url,"SKU OTHER").verified,false);
  assert.equal(sanitizePdpPairs(sample,base.sku,"https://fakesamsung.com/sec/refrigerators/rf90/RF90DB9000APKR/",declared).verified,false);
  assert.equal(sanitizePdpPairs(sample,base.sku,url,"Another product mentions RF90DB9000APKR somewhere").verified,false);
});

test("VD/HARMAN spec key-value pairs reject marketing text and checkout copy",()=>{
  assert.ok(normalizeSpecPair({name:"화면 해상도",value:"3840 x 2160"}));
  assert.ok(normalizeSpecPair({name:"블루투스 버전",value:"5.3"}));
  assert.equal(normalizeSpecPair({name:"구매가격",value:"1,220,000원"}),null);
  assert.equal(normalizeSpecPair({name:"출시 프로모션",value:"150,000원"}),null);
  assert.equal(normalizeSpecPair({name:"소비전력",value:"자세히 보기"}),null);
  assert.equal(normalizeSpecPair({name:"소비전력",value:"사용자 개인 정보"}),null);
});

test("cross-BU queue provides fair DA/VD/MX/HARMAN coverage and skips recent failed attempts",()=>{
  const tuples=[["DA","refrigerators"],["VD","tvs"],["MX","tablets"],["HARMAN","harman-lifestyle-audio"]];
  const rows=tuples.flatMap(([bu,category],i)=>Array.from({length:25},(_,j)=>({
    ...base,sku:"AA"+i+String(j).padStart(5,"0"),business_unit:bu,catalog_category:category,catalog_source_id:category,
    product_detail_url:"https://www.samsung.com/sec/"+category+"/slug/AA"+i+j+"/"
  })));
  const first=selectCrossBuSpecTargets(rows,{},Date.parse("2026-10-13T10:00:00Z"),12);
  assert.equal(first.length,12);
  assert.deepEqual([...new Set(first.map(row=>row.business_unit))].sort(),["DA","HARMAN","MX","VD"]);
  const attempts=Object.fromEntries(first.map(row=>[row.sku,{checked_at:"2026-10-13T09:00:00Z",status:"empty"}]));
  const second=selectCrossBuSpecTargets(rows,attempts,Date.parse("2026-10-13T10:00:00Z"),12);
  assert.equal(second.length,12);
  assert.ok(second.every(row=>!attempts[row.sku]));
  const third=selectCrossBuSpecTargets(rows,attempts,Date.parse("2026-10-15T12:00:00Z"),12);
  assert.equal(third.length,12);
  const withoutSpecs=selectCrossBuSpecTargets([{...base,specs:[{name:"전체 용량",value:"602L"}]}],{},Date.now(),10);
  assert.equal(withoutSpecs.length,0);
  assert.equal(selectCrossBuSpecTargets([{...base,catalog_category:"smartphones"}],{},Date.now(),10).length,0);
});

test("cross-BU SKU backfill is gated by a bounded run budget and persists state",async()=>{
  const {readFile}=await import("node:fs/promises");
  const crawler=await readFile("scripts/crawl.mjs","utf8");
  assert.match(crawler,/cross-bu-spec-batch/);
  assert.match(crawler,/renderCrossBuSpecs/);
  assert.match(crawler,/sanitizePdpPairs\(pairs,product\.sku,url,header\)/);
  assert.match(crawler,/spec_attempts\.json/);
  assert.match(crawler,/product\.spec_model_label=product\.sku/);
  assert.match(crawler,/await writeFile\(specAttemptsFile,/);
});
