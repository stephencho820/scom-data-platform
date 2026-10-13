/**
 * Publish a versioned and human-readable contract for actual KR data marts.
 *
 * Rows and field presence come from committed JSONL files, never mocked counts.
 * Keep full data in the existing marts; publish only a bounded sample here.
 */
import {readFile,writeFile,mkdir} from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const MARKET="kr";
const MART=path.join(ROOT,"data","marts",MARKET);
const output=path.resolve(process.argv[2]||"dist/data/catalog/kr.json");

export const definition=[
 {id:"sku_registry",layer:"A",group:"core",pk:"sku",foreign:["market_product_key"],tools:["get_kr_sku_knowledge","list_skus"],
  title:{kr:"SKU 영구 레지스트리",us:"SKU registry"},
  desc:{kr:"SKU마다 최초 발견된 제품 식별 정보와 사양을 보존합니다. 현재 판매 여부와는 별개로 과거 SKU를 유지합니다.",us:"Preserves identity and first-seen facts per SKU, independently of current selling status."},
  refresh:{kr:"최초 수집 후 보존 · 확인된 정정만 반영",us:"Capture once; preserve and correct verified facts"},
  grain:{kr:"국가 × 개별 SKU",us:"Market × exact SKU"}},
 {id:"product_master",layer:"A",group:"core",pk:"market_product_key",foreign:["sku_key"],tools:["get_product","search_products","list_skus"],
  title:{kr:"제품 마스터",us:"Product master"},
  desc:{kr:"SKU를 기준으로 제품명, 사업부, 카테고리, 모델명과 판매 상태를 정규화합니다. 식별 정보는 안정적이며 판매 상태는 재검증합니다.",us:"Normalized SKU identity, business unit, category, model and current lifecycle flags."},
  refresh:{kr:"제품 식별 정보 재사용 · 판매 상태는 수집 시 업데이트",us:"Stable identity; lifecycle state updated after each verified catalog check"},
  grain:{kr:"국가 × 개별 SKU",us:"Market × exact SKU"}},
 {id:"product_specs",layer:"A",group:"core",pk:"market_product_key",foreign:["sku_key"],tools:["get_product_specs","get_kr_sku_knowledge"],
  title:{kr:"제품 상세 스펙",us:"Product specifications"},
  desc:{kr:"제품별 구조화된 스펙(key/name/value/unit/source)과 수집 원본을 보존합니다. 행이 있어도 specs 배열이 비어 있을 수 있습니다.",us:"Technical key/value facts with source evidence. A row may exist while its specs array is empty."},
  refresh:{kr:"최초 스펙 확보 후 재사용 · 변경/누락 재검증",us:"First verified capture; corrections/backfill as needed"},
  grain:{kr:"국가 × 개별 SKU",us:"Market × exact SKU"}},
 {id:"taxonomy",layer:"B",group:"core",pk:"taxonomy_key",foreign:[],tools:["browse_category"],
  title:{kr:"카테고리 분류 체계",us:"Category taxonomy"},
  desc:{kr:"삼성닷컴 경로별 카테고리 계층과 출처를 저장합니다.",us:"Normalized category-path hierarchy and original source links."},
  refresh:{kr:"사이트 구조 변경 발견 시 갱신",us:"Recheck when site navigation or category structure changes"},
  grain:{kr:"국가 × 카테고리 경로",us:"Market × taxonomy path"}},
 {id:"support_resources",layer:"B",group:"core",pk:"support_key",foreign:["sku","model","market_product_key"],tools:["get_support_resources","get_kr_sku_knowledge"],
  title:{kr:"매뉴얼 · 고객지원 자료",us:"Support resources"},
  desc:{kr:"지원/매뉴얼/보증 관련 링크와 설명을 모읍니다. 현재는 SKU 연결 자료가 매우 부족합니다.",us:"Support, manual, and guidance documents. Exact-SKU linkage is currently sparse."},
  refresh:{kr:"문서 변경 감지 · 신규 모델 매뉴얼 반영",us:"Recheck for new versions and linked resources"},
  grain:{kr:"국가 × 개별 지원 문서",us:"Market × support resource"}},
 {id:"catalog_current",layer:"C",group:"live",pk:"sku",foreign:["catalog_source_id"],tools:["list_skus","get_kr_catalog_health"],
  title:{kr:"현재 카탈로그 관측값",us:"Current catalog observations"},
  desc:{kr:"카테고리 목록에서 수집한 현재 SKU, 판매 여부, 가격 관측값 등 원천 정보를 유지합니다. 전체 삼성닷컴 제품 완전성을 보장하지 않습니다.",us:"Category-listing observations of current SKUs and source status; not independent proof of Samsung.com-wide completeness."},
  refresh:{kr:"매 크롤링마다 공식 카탈로그 재대조",us:"Reconciled with official catalogs on each crawl"},
  grain:{kr:"국가 × 발견된 현재 SKU",us:"Market × catalog SKU"}},
 {id:"market_offers",layer:"C",group:"live",pk:"market_product_key",foreign:["sku_key"],tools:["get_market_offer","compare_market_offers"],
  title:{kr:"가격 · 판매 제안",us:"Market offers"},
  desc:{kr:"가격, 통화, 판매 가능 여부와 프로모션을 저장합니다. 행의 존재만으로 최신 가격이 보장되지 않으며 refresh_state의 검증 시각을 함께 확인해야 합니다.",us:"Price, currency, availability and promotions. Offer rows must pass a freshness check in refresh_state."},
  refresh:{kr:"주기적 재검증 · MCP 가격 유효기간 36시간",us:"Periodic verification; MCP price validity window 36 hours"},
  grain:{kr:"국가 × 판매 가능 SKU",us:"Market × commerce-eligible SKU"}},
 {id:"commerce_options",layer:"C",group:"live",pk:"market_product_key",foreign:["sku_key"],tools:["get_commerce_options"],
  title:{kr:"구매 · 구독 · 설치 옵션",us:"Commerce options"},
  desc:{kr:"구매방식, 구독, 보상판매, 케어, 배송/설치 등의 관측 데이터를 분류합니다. 확인되지 않은 빈 배열은 제공된 서비스의 확증이 아닙니다.",us:"Observed purchase, subscription, trade-in, protection, delivery and installation options. Empty arrays do not confirm availability."},
  refresh:{kr:"상세 페이지 확인 후 갱신 · 별도 최신성 검증",us:"Updated on verified detail-page refresh; separate freshness gate"},
  grain:{kr:"국가 × 판매 가능 SKU",us:"Market × commerce-eligible SKU"}},
 {id:"refresh_state",layer:"C",group:"live",pk:"market_product_key",foreign:["market_product_key"],tools:["get_market_offer","get_commerce_options"],
  title:{kr:"검증 시각 · 신선도",us:"Verification freshness"},
  desc:{kr:"SKU별 가격·상거래 옵션이 실제로 재검증된 시각을 추적합니다. 빈 값(null)은 해당 검증 이력이 없다는 뜻입니다.",us:"Tracks actual last verification timestamps for offers and commerce options; null means not verified."},
  refresh:{kr:"검증 성공 시에만 확인 시각 갱신",us:"Timestamp advances only after source verification"},
  grain:{kr:"국가 × 개별 SKU",us:"Market × SKU"}},
 {id:"history_products",file:"data/history/products/kr.jsonl",layer:"B",group:"history",pk:"key",foreign:["sku"],tools:["get_product_history"],
  title:{kr:"제품 변경 이력",us:"Product versions"},
  desc:{kr:"제품명, 모델, 스펙 등 식별 프로필 변경 시 저장된 버전입니다.",us:"Version history of changed product identity and specification profiles."},
  refresh:{kr:"내용 변경 시 새 버전 추가",us:"Append when material identity/spec facts change"},
  grain:{kr:"제품 키 × 변경 버전",us:"Product key × version"}},
 {id:"history_offers",file:"data/history/offers/kr.jsonl",layer:"C",group:"history",pk:"market_product_key",foreign:[],tools:["get_product_history"],
  title:{kr:"가격 변경 이력",us:"Offer history"},
  desc:{kr:"가격/프로모션 변경 관측의 히스토리입니다. 과거 가격을 현재 판매 가격으로 사용하지 않습니다.",us:"Historical offer changes. Historical prices are never treated as live quotes."},
  refresh:{kr:"가격 내용이 바뀐 경우 이력 추가",us:"Append on observed offer changes"},
  grain:{kr:"SKU × 가격 변경 버전",us:"SKU × price version"}},
 {id:"history_commerce_options",file:"data/history/commerce_options/kr.jsonl",layer:"C",group:"history",pk:"market_product_key",foreign:[],tools:["get_product_history"],
  title:{kr:"구매 옵션 변경 이력",us:"Commerce option history"},
  desc:{kr:"구독, 설치, 보상판매 등의 구매 옵션 변경 이력입니다.",us:"Change history of observed purchase and fulfillment options."},
  refresh:{kr:"옵션 변경 시 이력 추가",us:"Append when options change"},
  grain:{kr:"SKU × 옵션 변경 버전",us:"SKU × option version"}}
];

export const fieldHelp={
 market_product_key:["국가 내 SKU 조인 키","Market-local SKU join key"],
 sku_key:["SKU 식별 키","SKU identifier key"],
 sku:["제품 고유 SKU 코드","Exact product SKU code"],
 market:["국가/시장 코드","Market code"],
 business_unit:["사업부: DA·VD·MX·HARMAN 등","Business unit such as DA, VD, MX or HARMAN"],
 category:["제품 카테고리","Product category"],
 category_path:["카테고리 경로","Category breadcrumb path"],
 product_family:["제품군/상품 그룹","Product family or group"],
 variant_attributes:["색상·용량 등 옵션 속성","Variant attributes such as color and capacity"],
 model:["제조사 모델 코드","Manufacturer model identifier"],
 name:["제품명","Product name"],
 brand:["브랜드명","Brand name"],
 audience:["소비자/기업 등 대상 구분","Consumer/business audience"],
 product_url:["삼성닷컴 제품 상세 URL","Official Samsung.com product URL"],
 source_url:["검증 또는 수집에 사용한 원본 URL","Source evidence URL"],
 source_urls:["복수 출처 URL 목록","List of source URLs"],
 purchase_url:["구매 상세 페이지 URL","Official purchase URL"],
 type:["자료 유형","Resource type"],
 title:["자료 제목","Resource title"],
 description:["문서 설명","Resource description"],
 support_key:["지원 문서 식별 키","Support document identity key"],
 taxonomy_key:["카테고리 경로 식별 키","Taxonomy path identity key"],
 path:["계층형 카테고리 경로","Hierarchical taxonomy path"],
 sku_registry:["등록된 SKU 카운트","Registered SKU count"],
 key:["제품 또는 페이지 내부 키","Internal product or page key"],
 specs:["기술 사양의 key/name/value/unit/source 배열","Structured technical facts (key/name/value/unit/source)"],
 "specs[].key":["표준화된 스펙 키","Normalized spec property key"],
 "specs[].name":["화면 표시용 스펙 명칭","Human-readable specification label"],
 "specs[].value":["수집된 스펙 값","Observed specification value"],
 "specs[].unit":["값의 단위(있으면)","Unit when present"],
 "specs[].source":["스펙별 확인 출처 방식","Fact-level evidence method"],
 source_model:["원본에서 확인된 모델명","Source-declared model identifier"],
 price:["수집된 금액; 최신성 별도 검증 필요","Collected amount; check verification freshness separately"],
 currency:["가격 통화","Currency of the offer"],
 promotions:["관측된 프로모션 목록","Observed promotions"],
 offers:["카탈로그에서 관측한 가격/재고 객체","Offer observation in source catalog"],
 availability:["공식 출처의 판매 가능 상태","Observed availability state"],
 lifecycle_status:["현재 판매·품절·단종 분류","Current selling / unavailable / retired classification"],
 catalog_current:["현행 카탈로그 목록 포함 여부","Whether present in current collected catalog"],
 sellable:["현재 판매 가능 판정","Observed sellability status"],
 catalog_enforced:["목록 기반 현행성 검증 적용 여부","Whether catalog verification policy applies"],
 commerce_eligible:["상거래 데이터 제공 가능 여부","Whether current commerce data is eligible"],
 catalog_source_id:["원천 카테고리 수집 소스 ID","Catalog source identifier"],
 catalog_source_url:["원천 카테고리 URL","Catalog listing source URL"],
 catalog_group_path:["카탈로그 상품 그룹 경로","Catalog group path"],
 catalog_category:["수집 카탈로그 분류","Source catalog category"],
 product_detail_url:["실제 상세 페이지 URL","Product detail page URL"],
 catalog_verified_at:["해당 카탈로그를 검증한 시각","Time catalog membership was verified"],
 captured_at:["행 또는 스냅샷 최초 기록 시각","Row or snapshot capture time"],
 first_seen_at:["SKU 최초 발견 시각","First observed time for SKU"],
 immutable_profile_captured_at:["불변 프로필 기록 시각","Time original identity profile was saved"],
 spec_captured_at:["기술 스펙 확인 시각","Specification capture time"],
 spec_source_url:["스펙 원본 페이지 주소","Specification source URL"],
 spec_model_label:["검증된 스펙 원본 모델 표기","Source model label for specs"],
 offer_checked_at:["가격이 최종으로 검증된 시각","Last verified offer time"],
 commerce_checked_at:["구매 옵션이 최종으로 검증된 시각","Last verified commerce options time"],
 purchase_methods:["관측된 구매 방법","Observed purchase methods"],
 subscriptions:["관측된 구독 방식","Observed subscription options"],
 trade_in:["보상판매 정보","Trade-in options"],
 protection:["케어/보호 서비스","Protection and care options"],
 delivery:["배송 관련 관측 옵션(실시간 배송 약속 아님)","Observed delivery options, not live delivery promise"],
 installation:["설치 서비스 옵션","Installation options"],
 haul_away:["기존 제품 수거 옵션","Old-appliance haul-away options"],
 bundles:["묶음 구매/번들","Bundle options"],
 membership:["멤버십 혜택","Membership options"],
 catalog_sale_status:["카탈로그 판매 상태 원시 코드","Raw catalog selling-status code"],
 catalog_stock_qty:["카탈로그 관측 수량; 실시간 재고 아님","Observed catalog quantity, not live inventory"],
 fingerprint:["변경 감지용 해시","Content fingerprint used for change detection"],
 url:["제품 또는 문서 URL","Product or document URL"],
 last_checked_at:["마지막 관측 시각","Last observed time"],
 "offers.price":["카탈로그 상품 가격","Catalog offer price"],
 "offers.currency":["통화","Currency"],
 "offers.availability":["카탈로그 가용 상태","Catalog availability flag"]
};

function nonEmpty(x){
 if(x==null)return false;
 if(typeof x==="string")return x.trim().length>0;
 if(Array.isArray(x))return x.length>0;
 if(typeof x==="object")return Object.keys(x).length>0;
 return true;
}
function inferType(value){
 if(value===null)return "null";
 if(Array.isArray(value))return "array";
 if(typeof value==="object")return "object";
 if(typeof value==="number")return "number";
 if(typeof value==="boolean")return "boolean";
 return "string";
}
function sampleValue(value){
 if(Array.isArray(value))return value.slice(0,3).map(v=>sampleValue(v));
 if(value && typeof value==="object")return Object.fromEntries(Object.entries(value).slice(0,16).map(([k,v])=>[k,sampleValue(v)]));
 if(typeof value==="string")return value.slice(0,200);
 return value;
}
export function inspectDataset(rows,definition){
 const fields=new Map();
 for(const row of rows){
  if(!row||typeof row!=="object")continue;
  for(const [key,value] of Object.entries(row)){
   if(!fields.has(key))fields.set(key,{name:key,seen:0,populated:0,types:new Set(),example:null});
   const f=fields.get(key);f.seen++;f.types.add(inferType(value));
   if(nonEmpty(value)){f.populated++;if(f.example===null)f.example=sampleValue(value);}
   if(Array.isArray(value)&&value.some(v=>v&&typeof v==="object")&&key==="specs"){
    for(const item of value.slice(0,100)){
     if(!item||typeof item!=="object")continue;
     for(const [nestedKey,nestedVal] of Object.entries(item)){
      const name=key+"[]."+nestedKey;
      if(!fields.has(name))fields.set(name,{name,seen:0,populated:0,types:new Set(),example:null});
      const f=fields.get(name);
      f.seen++;f.types.add(inferType(nestedVal));
      if(nonEmpty(nestedVal)){f.populated++;if(f.example===null)f.example=sampleValue(nestedVal);}
     }
    }
   }
  }
 }
 const fieldsOut=[...fields.values()].map(f=>({
   name:f.name,type:[...f.types].sort().filter(x=>x!=="null").join(" | ")||"null",
   present:f.seen,populated:f.populated,
   description:{kr:fieldHelp[f.name]?.[0]||"수집된 원본 필드",us:fieldHelp[f.name]?.[1]||"Collected source field"},
   example:f.example
 }));
 const sample=rows.find(r=>definition.id==="product_specs"?(r.specs||[]).length>0:
   definition.id==="product_master"?r.lifecycle_status==="current_sellable":
   definition.id==="refresh_state"?Boolean(r.offer_checked_at):
   definition.id==="support_resources"?Boolean(r.title):
   definition.id==="catalog_current"?(r.specs||[]).length>0:
   definition.id==="sku_registry"?(r.specs||[]).length>0:true)||rows[0]||null;
 const preview=sample?Object.fromEntries(Object.entries(sample).map(([k,v])=>[k,sampleValue(v)])):null;
 return {row_count:rows.length,columns:fieldsOut,sample:preview};
}
async function readJsonl(file){
 try{return (await readFile(file,"utf8")).split(/\r?\n/).filter(Boolean).map(JSON.parse);}
 catch(error){if(error.code==="ENOENT")return [];throw error;}
}
async function readJson(file){
 try{return JSON.parse(await readFile(file,"utf8"));}
 catch(error){if(error.code==="ENOENT")return null;throw error;}
}
export async function buildCatalog(root=ROOT){
 const dir=path.join(root,"data/marts",MARKET);
 const snapshot=await readJson(path.join(dir,"chatbot_readiness.json"));
 const meta=await readJson(path.join(root,"data/current",MARKET,"meta.json"));
 const audits=await Promise.all([
  "chatbot_readiness","current_catalog_coverage","incremental_report","quality_backlog"
 ].map(async id=>{const item=await readJson(path.join(dir,id+".json"));return {id,exists:item!==null,source_file:"data/marts/"+MARKET+"/"+id+".json",updated_at:item?.generated_at||item?.checked_at||item?.captured_at||null};}));
 const datasets=[];
 for(const def of definition){
  const file=def.file||"data/marts/"+MARKET+"/"+def.id+".jsonl";
  const rows=await readJsonl(path.join(root,file));
  datasets.push({...def,file,...inspectDataset(rows,def)});
 }
 return {
  schema_version:1,market:MARKET,built_at:new Date().toISOString(),
  snapshot_at:snapshot?.generated_at||meta?.captured_at||null,
  scope_note:"Built from committed GitHub JSONL; presence of a row does not certify completeness or current price.",
  readiness:{ready:snapshot?.ready===true,counts:snapshot?.counts||{},gates:snapshot?.gates||{}},
  crawl:meta?{coverage_percent:meta.coverage_percent,target_urls:meta.target_urls_total,visited_urls:meta.coverage_urls}:null,
  tables:datasets,reports:audits,
  realtime:{integrated:false,description:"Delivery estimates, authenticated orders and local stock require authorized APIs."}
 };
}
if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 const result=await buildCatalog();
 await mkdir(path.dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify(result));
 console.log("catalog manifest:"+result.tables.length+" marts / "+result.tables.reduce((n,x)=>n+x.row_count,0)+" total rows; snapshot "+result.snapshot_at);
}
