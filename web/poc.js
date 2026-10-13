/**
 * Real records + truthful MCP-equivalent routes. This static GitHub Pages
 * experience NEVER executes MCP tools or official live commerce services.
 */
const pocI18n = {
  kr: {
    loading:"수집된 SKU 목록을 불러오는 중…",loadFailed:"데이터를 불러오지 못했습니다. 잠시 후 다시 시도하거나 SKU 탐색기를 이용해 주세요.",
    retry:"다시 불러오기",empty:"검색 조건에 맞는 SKU가 없습니다.",search:"제품명 또는 SKU 검색",
    selected:"선택된 SKU",count:"개 SKU 조회 가능",snapshot:"데이터 스냅샷",specCount:"스펙",
    collected:"실제 수집된 정보",unknown:"아직 수집되지 않았습니다",source:"출처",
    sku:"제품 SKU",bu:"사업부",category:"카테고리",model:"모델",variant:"옵션",
    specsNone:"이 SKU는 제품 식별 정보는 있지만 구조화된 스펙이 아직 수집되지 않았습니다.",
    docsNone:"이 SKU에 정확히 연결된 지원 자료가 아직 없습니다. 일반 고객지원 페이지를 이 제품의 공식 매뉴얼인 것처럼 표시하지 않습니다.",
    docsSome:"연결된 공식 지원 자료",offerNone:"해당 SKU에 대해 최근 검증된 판매 가격이 없습니다. 가격을 추측하거나 오래된 가격을 표시하지 않습니다.",
    offerExpired:"이 SKU의 가격 확인 시간이 36시간을 초과했습니다. 최신 가격이라고 답하지 않습니다.",
    offerValid:"마지막으로 확인한 가격 (결제 가격 보장 아님)",lastChecked:"가격 확인",brandSource:"삼성닷컴 원본",
    realtime:"배송지·주문·재고 확인에는 인증된 공식 실시간 API가 필요합니다. 현재 공개 MCP는 이를 제공하지 않습니다.",
    onlyExample:"아래 명령은 로컬 MCP 호출 예시입니다. 이 페이지는 저장된 스냅샷을 조회하며 MCP 서버를 직접 호출하지 않습니다.",
    aRoute:"Immutable · Product Master / Specs",bRoute:"Versioned · Knowledge / Support",
    cRoute:"Dynamic · Market Offers",dRoute:"Real-time · Authorized API required",
    aExplanation:"SKU 프로필과 이미 수집한 사양을 재사용합니다.",bExplanation:"해당 SKU에 실제로 연결된 지원 자료만 사용합니다.",
    cExplanation:"실제로 기록된 가격도 유효기간을 확인한 후에만 표시합니다.",dExplanation:"현재 정적 데이터로 배송이나 개인 재고를 단정할 수 없습니다."
  },
  us: {
    loading:"Loading collected SKU records…",loadFailed:"Could not load the dataset. Retry or open the SKU explorer.",
    retry:"Try again",empty:"No matching SKUs.",search:"Search by product name or SKU",
    selected:"Selected SKU",count:"collected SKUs",snapshot:"Snapshot",specCount:"specs",
    collected:"Collected evidence",unknown:"Not yet collected",source:"Evidence",
    sku:"SKU",bu:"Business unit",category:"Category",model:"Model",variant:"Variant",
    specsNone:"Product identity is available, but structured specifications have not been captured for this SKU.",
    docsNone:"No support record is linked to this exact SKU. Generic support pages are not presented as product-specific manuals.",
    docsSome:"Linked official support records",offerNone:"No recently verified selling price is available. Unverified or old prices are never guessed.",
    offerExpired:"The last price verification is more than 36 hours old and cannot be quoted as current.",
    offerValid:"Last verified offer (not a checkout quote)",lastChecked:"Price checked",brandSource:"Official Samsung.com",
    realtime:"Stock, orders and delivery estimates require separate authorized real-time APIs. The public MCP does not currently include them.",
    onlyExample:"The command below is an example of a local MCP call. This page reads published snapshot data, not a running MCP server.",
    aRoute:"Immutable · Product Master / Specs",bRoute:"Versioned · Knowledge / Support",
    cRoute:"Dynamic · Market Offers",dRoute:"Real-time · Authorized API required",
    aExplanation:"Reuse the captured SKU identity and structured specification records.",
    bExplanation:"Only support resources linked to the exact SKU can be treated as product-specific evidence.",
    cExplanation:"Even collected prices are displayed only while recently verified.",
    dExplanation:"Static records cannot promise delivery or personalized stock."
  }
};

const poc = {data:null,products:[],sku:null,scenario:"a",bu:"ALL",query:"",error:false};
const byId=id=>document.getElementById(id);
const word=key=>pocI18n[window.ScomSite.language()][key] || key;
function setText(id,value){const el=byId(id);if(el)el.textContent=value;}
function element(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;}
function officialSource(value){
  try{const url=new URL(value);return url.protocol==="https:"&&url.hostname==="www.samsung.com"?url.href:"";}catch{return "";}
}
function createEvidenceRow(label,value){
  const row=element("div","poc-field");
  row.append(element("span","poc-field-label",label),element("strong","poc-field-value",value));
  return row;
}
function formatTime(value){
  const d=new Date(value || "");
  return Number.isFinite(d.getTime())?new Intl.DateTimeFormat(window.ScomSite.language()==="kr"?"ko-KR":"en-US",{dateStyle:"medium",timeStyle:"short"}).format(d):"—";
}
function verifiedOffer(record, now=Date.now()){
  const stamp=Date.parse(record?.offer?.checked_at||"");
  return Number.isFinite(stamp)&&now>=stamp&&now-stamp<=36*3600000&&
    record.lifecycle==="current_sellable"&&Boolean(record.offer?.price)&&Boolean(officialSource(record.offer?.source_url));
}
function money(offer){
  const n=Number(offer.price);
  if(!Number.isFinite(n)||n<=0)return word("unknown");
  return new Intl.NumberFormat(window.ScomSite.language()==="kr"?"ko-KR":"en-US",{
    style:"currency",currency:offer.currency||"KRW",maximumFractionDigits:0
  }).format(n);
}
function renderOptions(){
  const select=byId("demo-sku-select");
  if(!select)return;
  const matching=poc.products.filter(item=>poc.bu==="ALL"||item.bu===poc.bu).filter(item=>{
    const query=poc.query.trim().toLowerCase();
    return !query||[item.name,item.sku,item.model,item.category].some(x=>String(x||"").toLowerCase().includes(query));
  });
  // All records stay available in the selector; the selected item is stable
  // unless filters intentionally exclude it.
  const visible=matching.slice(0,200);
  if(!visible.some(item=>item.key===poc.sku))poc.sku=visible[0]?.key||null;
  select.replaceChildren();
  if(!visible.length){
    const item=element("option","",poc.error?word("loadFailed"):poc.data?word("empty"):word("loading"));
    item.value="";select.append(item);select.disabled=true;
  } else {
    for(const item of visible){
      const option=element("option","",item.name+" · "+item.sku);
      option.value=item.key;
      select.append(option);
    }
    select.disabled=false;select.value=poc.sku;
  }
  byId("demo-sku-search").placeholder=word("search");
  document.querySelectorAll("[data-demo-bu]").forEach(button=>{
    const active=button.dataset.demoBu===poc.bu;
    button.classList.toggle("is-active",active);
    button.setAttribute("aria-pressed",String(active));
  });
  const current=poc.products.find(item=>item.key===poc.sku);
  setText("demo-product-summary",current
    ? current.bu+" · "+current.sku+" · "+current.specs.length+" "+word("specCount")
    : poc.error?word("loadFailed"):poc.data?word("empty"):word("loading"));
}
function renderEvidence(record){
  const box=byId("demo-evidence");
  if(!box)return;
  box.replaceChildren();
  if(!record){
    box.append(element("p","poc-empty",poc.error?word("loadFailed"):word("loading")));
    return;
  }
  const heading=element("div","poc-evidence-heading");
  heading.append(element("strong","",word("collected")));
  const quality=element("span","poc-quality",poc.scenario.toUpperCase());
  heading.append(quality);box.append(heading);
  const grid=element("div","poc-fields");
  if(poc.scenario==="a"){
    grid.append(createEvidenceRow(word("sku"),record.sku));
    grid.append(createEvidenceRow(word("bu"),record.bu+" / "+record.category));
    if(record.model&&record.model!==record.sku)grid.append(createEvidenceRow(word("model"),record.model));
    for(const [name,value] of Object.entries(record.variants||{}).slice(0,2)){
      if(value)grid.append(createEvidenceRow(name,String(value)));
    }
    for(const spec of record.specs.slice(0,6)){
      grid.append(createEvidenceRow(spec.name,spec.value+(spec.unit&& !spec.value.includes(spec.unit)?" "+spec.unit:"")));
    }
    if(!record.specs.length)box.append(element("p","poc-empty",word("specsNone")));
  } else if(poc.scenario==="b"){
    const linked=record.support||[];
    if(!linked.length)box.append(element("p","poc-empty",word("docsNone")));
    else {
      grid.append(createEvidenceRow(word("docsSome"),String(linked.length)));
      for(const item of linked){
        const link=element("a","poc-support-link",item.title+" ↗");
        const url=officialSource(item.url);
        if(!url)continue;
        link.href=url;link.target="_blank";link.rel="noopener noreferrer";
        grid.append(link);
      }
    }
  } else if(poc.scenario==="c"){
    if(verifiedOffer(record)){
      grid.append(createEvidenceRow(word("offerValid"),money(record.offer)));
      grid.append(createEvidenceRow(word("lastChecked"),formatTime(record.offer.checked_at)));
    } else box.append(element("p","poc-empty",record.offer?word("offerExpired"):word("offerNone")));
  } else if(poc.scenario==="d"){
    box.append(element("p","poc-empty",word("realtime")));
  }
  box.append(grid);
}
function renderPoc(){
  const record=poc.products.find(x=>x.key===poc.sku);
  const type=poc.scenario;
  document.querySelectorAll("[data-scenario]").forEach(button=>{
    const active=button.dataset.scenario===type;
    button.classList.toggle("is-active",active);button.setAttribute("aria-pressed",String(active));
  });
  document.querySelectorAll("[data-type]").forEach(button=>{
    const active=button.dataset.type===type;
    button.classList.toggle("is-active",active);button.setAttribute("aria-pressed",String(active));
  });
  setText("demo-symbol",type.toUpperCase());
  setText("demo-route",word(type+"Route"));
  setText("demo-explanation",word(type+"Explanation"));
  const messages=window.ScomSite.language()==="kr"?
    {a:"이 제품의 스펙은?",b:"이 제품의 지원 자료는?",c:"지금 할인 중인가요?",d:"내일 배송되나요?"}:
    {a:"What are the specifications?",b:"Are support resources linked?",c:"Is the price verified?",d:"Can it arrive tomorrow?"};
  setText("demo-question","“"+messages[type]+(record?" · "+record.sku:"")+"”");
  const key=record?.key||"<SKU>";
  const command=type==="a"?`get_product_specs({ market: "kr", product_key: "${key}" })`
    :type==="b"?`get_support_resources({ market: "kr", query: "${record?.sku||"<SKU>"}" })`
    :type==="c"?`get_market_offer({ market: "kr", product_key: "${key}" })`
    :"Integration required: authorized inventory / delivery API";
  setText("demo-code",command);
  setText("demo-note",word("onlyExample"));
  const source=byId("demo-source");
  const url=officialSource(type==="c"&&verifiedOffer(record)?record?.offer?.source_url:record?.source_url);
  if(source){source.hidden=!url;if(url)source.href=url;}
  setText("demo-snapshot-age",poc.data?word("snapshot")+": "+formatTime(poc.data.generated_at):"");
  renderEvidence(record);
}
async function fetchPocData(){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch("./data/demo/kr.json",{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw Error("HTTP "+response.status);
    const data=await response.json();
    if(data?.schema_version!==1||data.market!=="kr"||!Array.isArray(data.products))throw Error("Unexpected schema");
    poc.data=data;poc.products=data.products;
    poc.error=false;
    const retry=byId("demo-retry");if(retry)retry.hidden=true;
    renderOptions();renderPoc();
  }catch{
    poc.error=true;
    const retry=byId("demo-retry");if(retry){retry.hidden=false;retry.textContent=word("retry")+" ↻";}
    renderOptions();renderPoc();
  }finally{clearTimeout(timer);}
}
const retry=byId("demo-retry");if(retry)retry.addEventListener("click",()=>{retry.hidden=true;poc.error=false;fetchPocData();});
const search=byId("demo-sku-search");
if(search)search.addEventListener("input",()=>{poc.query=search.value;renderOptions();renderPoc();});
const picker=byId("demo-sku-select");
if(picker)picker.addEventListener("change",()=>{poc.sku=picker.value;renderPoc();});
document.querySelectorAll("[data-demo-bu]").forEach(el=>el.addEventListener("click",()=>{
  poc.bu=el.dataset.demoBu;renderOptions();renderPoc();
}));
document.querySelectorAll("[data-scenario]").forEach(el=>el.addEventListener("click",()=>{
  poc.scenario=el.dataset.scenario;renderPoc();
}));
document.querySelectorAll("[data-type]").forEach(el=>el.addEventListener("click",()=>{
  poc.scenario=el.dataset.type;renderPoc();
  byId("demo")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
}));
window.ScomSite.onLanguageChange(()=>{renderOptions();renderPoc();});
renderOptions();renderPoc();fetchPocData();
