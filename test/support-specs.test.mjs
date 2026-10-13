import test from "node:test";
import assert from "node:assert/strict";
import {modelAliases,supportModelUrl,supportSpecEvidence,parseSupportSpecText} from "../src/pipeline/support-specs.mjs";

const SKU="LS27C900PAKXKR";
const SOURCE="https://www.samsung.com/sec/support/model/LS27C900PAKXKR/";
const officialPage=[
 "매뉴얼 & 다운로드","뷰피니티 S9 S90PC 5K 스마트 (LS27C900)","S27C900PAK","S27C900PAK",
 "스펙","스펙","뷰피니티 S9 S90PC 5K 스마트 (LS27C900)","디스플레이",
 "1. 화면사이즈 (cm)","68.4","2. 화면비율","16:9",
 "3. 패널 타입","IPS","4. 해상도","5,120 x 2,880",
 "5. 주사율","Max 60 Hz","6. 밝기 (Typical)","600 cd/㎡",
 "7. 칼라지원","Max 1 B",
 "스마트","1. 운영체제","Tizen™",
 "전원","1. 소비전력 (Typical)","37.0 W",
 "크기","1. 스탠드포함(가로x높이x깊이)","611.4 x 530.7 x 135.3 mm",
 "무게","1. 제품 무게 (스탠드 포함)","7.4 kg",
 "워런티 정보","제품 지원","고객센터"
].join("\n");

test("model support parser validates exact official URL and model-family label",()=>{
  assert.ok(modelAliases(SKU).includes("S27C900PAK"));
  assert.equal(supportModelUrl(SKU),SOURCE);
  const parsed=supportSpecEvidence({sku:SKU,url:SOURCE,text:officialPage});
  assert.equal(parsed.verified,true);
  assert.equal(parsed.match_type,"model_family_alias");
  assert.equal(parsed.source_model,"S27C900PAK");
  assert.ok(parsed.specs.length>=8,JSON.stringify(parsed.specs));
  assert.ok(parsed.specs.every(s=>s.source==="samsung_support_verified"));
  assert.ok(parsed.specs.some(s=>s.name==="해상도"&&s.value.includes("5,120")));
  assert.ok(parsed.specs.some(s=>s.name.includes("소비전력")));
  assert.ok(parsed.specs.some(s=>s.name.includes("무게")));
});
test("support page is rejected when URL, declared model or specs are wrong",()=>{
  const mismatches=[
    {sku:SKU,url:SOURCE.replace(SKU,"LS27C900PAKXKR2"),text:officialPage},
    {sku:SKU,url:SOURCE.replace("www.samsung.com","samsung.com.evil.test"),text:officialPage},
    {sku:SKU,url:"https://www.samsung.com/sec/support/",text:officialPage},
    {sku:SKU,url:SOURCE,text:officialPage.replaceAll("S27C900PAK","NOT_THIS_MODEL")},
    {sku:SKU,url:SOURCE,text:"갤럭시 추천 상품\nSKU "+SKU+"\n스펙\n스마트폰을 확인하세요"},
    {sku:SKU,url:SOURCE,text:"매뉴얼 & 다운로드\nS27C900PAK\n스펙\n고객센터"}
  ];
  for(const item of mismatches)assert.equal(supportSpecEvidence(item).verified,false,JSON.stringify(item).slice(0,160));
});
test("parser reads only technical pairs bounded to spec accordion",()=>{
  const parsed=parseSupportSpecText(officialPage);
  assert.ok(parsed.length>=8);
  assert.ok(!parsed.some(s=>s.name==="고객센터"||s.name==="워런티 정보"));
  assert.ok(!parsed.some(s=>s.value==="제품 지원"));
});
test("slash-bearing Samsung model codes use URL-safe support route",()=>{
  assert.equal(supportModelUrl("HW-B450F/KR"),"https://www.samsung.com/sec/support/model/HW-B450F%2FKR/");
});
test("crawler uses support fallback and persists traceable SKU provenance",async()=>{
  const {readFile}=await import("node:fs/promises");
  const crawler=await readFile("scripts/crawl.mjs","utf8");
  assert.match(crawler,/async function renderOfficialSupportSpecs/);
  assert.match(crawler,/supportSpecEvidence\(\{sku:product\.sku,url:page\.url\(\),text\}\)/);
  assert.match(crawler,/support_checked:fallbackChecked/);
  assert.match(crawler,/product\.spec_source_url=result\.sourceUrl/);
  assert.match(crawler,/product\.spec_model_label=result\.source_model\|\|product\.sku/);
});
