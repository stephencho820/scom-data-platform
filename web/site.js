/* Landing + secondary-pages language switch, and conceptual MCP routing demo. */
const copy = {
  kr: {
    skip:"본문으로 바로가기",navLifecycle:"4가지 데이터",navDemo:"작동 방식",navConnect:"MCP 연결",tryMcp:"MCP 시작하기",
    heroEyebrow:"AI 에이전트를 위한 삼성닷컴 데이터 플랫폼",heroTitle1:"제품 정보는 한 번.",heroTitle2:"바뀌는 정보만 새롭게.",
    heroDescription:"제품 스펙부터 가격, 재고까지. 모든 정보를 똑같이 크롤링할 필요는 없습니다. 데이터의 성격에 따라 수집하고, 하나의 MCP로 제공합니다.",
    exploreTypes:"4가지 유형 살펴보기",seeExample:"작동 방식 체험",heroFoot1:"SKU 중심으로 정리",heroFoot2:"출처 및 최신성 확인",
    visualEyebrow:"데이터 처리 구조 · 개념 예시",visualSource:"국가별 제품 및 서비스 정보",
    visualA:"제품 스펙",visualADesc:"최초 수집 · 재사용",visualAStatus:"KEEP",
    visualB:"FAQ · 정책",visualBDesc:"변경될 때만 업데이트",visualBStatus:"DETECT",
    visualC:"가격 · 프로모션",visualCDesc:"주기적으로 확인",visualCStatus:"REFRESH",
    visualD:"재고 · 배송",visualDDesc:"공식 실시간 연동 필요",visualDStatus:"CONNECT",visualBottom:"필요한 데이터를 에이전트에 전달",
    typesEyebrow:"THE FOUR DATA LIFECYCLES",typesTitle1:"데이터가 다르면,",typesTitle2:"수집 방식도 달라야 합니다.",
    typesDescription:"삼성닷컴 챗봇에 필요한 데이터를 네 가지로 구분했습니다. 각 카드를 누르면 실제 질문에 어떻게 활용되는지 볼 수 있어요.",
    aTag:"ONCE",bTag:"ON CHANGE",cTag:"SCHEDULED",dTag:"ON DEMAND",typeStrategy:"수집 전략",
    aHeading:"한 번 수집",aDesc:"제품명, SKU, 스펙, 크기, 색상처럼 오래 유지되는 정보",aStrategy:"최초 구축 후 재사용",aExample:"예: 갤럭시 카메라 사양",
    bHeading:"바뀔 때만",bDesc:"FAQ, 사용 설명서, 호환성, 서비스 정책처럼 가끔 수정되는 정보",bStrategy:"변경 감지 후 갱신",bExample:"예: 새로 추가된 FAQ",
    cHeading:"자주 새롭게",cDesc:"가격, 할인, 프로모션, 판매 상태처럼 자주 달라지는 정보",cStrategy:"주기적 확인 · 변경분 반영",cExample:"예: 오늘의 판매 가격",
    dHeading:"그때 바로",dDesc:"지역별 재고, 배송 예정일, 개인 혜택, 주문 상태처럼 고객마다 다른 정보",dStrategy:"질문 시 공식 API 조회",dExample:"예: 내일 배송 가능할까?",
    typeCaveat:"A도 정정 가능성을 확인합니다. D는 크롤링 데이터가 아닌 별도 공식 API 연동이 필요하며, 현재 공개 MCP에는 포함되지 않습니다.",
    demoEyebrow:"INTERACTIVE POC",demoTitle1:"질문 하나로 이해하는",demoTitle2:"데이터의 흐름.",
    demoDescription:"실제 수집된 삼성 제품을 선택해 보세요. SKU별 스펙, 연결된 지원 자료, 검증된 가격을 보여줍니다. 실시간 서비스는 연동 범위를 안내합니다.",
    demoChoose:"질문을 선택하세요",demoOptionA:"이 제품의 스펙은?",demoOptionB:"이 제품의 지원 자료는?",demoOptionC:"지금 할인 중인가요?",demoOptionD:"내일 배송되나요?",
    demoDisclaimer:"제품 정보는 실제 수집 마트의 정적 스냅샷입니다. 표시된 MCP 명령은 호출 예시이며 실시간 재고·배송 API는 연결되지 않았습니다.",
    screenTitle:"AGENT DATA ROUTE · ACTUAL SNAPSHOT",screenDemo:"SNAPSHOT",screenQuestion:"CUSTOMER QUESTION",screenRoute:"DATA ROUTE",screenOutput:"MCP / NEXT ACTION",
    connectEyebrow:"READY FOR AI AGENTS",connectTitle1:"데이터를 모으는 대신,",connectTitle2:"MCP로 사용하세요.",
    connectDescription:"SKU 검색, 제품 스펙, 수집된 가격, 지원 자료를 하나의 인터페이스로 조회할 수 있습니다. 현재는 오픈소스 기반 로컬 stdio MCP입니다.",
    connectGuide:"MCP 연결 가이드",connectStatus:"현재 데이터 상태 확인",connectCaveat:"※ 수집 범위와 완성도는 국가별로 다릅니다. 인증이 필요한 실시간 재고·배송·주문 조회는 아직 제공하지 않습니다.",
    copyCode:"복사",copied:"복사됨 ✓",copyFailed:"코드를 직접 선택해 주세요",terminalFooter:"Node.js 20+ · 로컬 stdio MCP",
    bottomTitle:"수집 현황도 투명하게.",bottomDescription:"데이터가 아직 완성되지 않았다면 완료된 것처럼 말하지 않습니다. SKU 누락과 검증 상태를 그대로 보여줍니다.",
    bottomStatus:"수집 상태 보기 ↗",bottomExplorer:"SKU 데이터 탐색 ↗",bottomCatalog:"데이터 마트 명세 ↗",statusCatalog:"데이터 마트 명세서 보기 ↗",footerDisclaimer:"독립적인 커뮤니티 프로젝트이며 삼성 공식 서비스가 아닙니다.",
    statusEyebrow:"DATA QUALITY · KOREA",statusTitle:"현재 수집 상태",statusLead:"수집이 진행 중인 데이터의 커버리지와 품질을 그대로 공개합니다. 검증되지 않은 정보를 완성이라고 표시하지 않습니다.",
    backHome:"← 홈으로",statusLoading:"데이터 상태 확인 중…",statusReady:"READY",statusNotReady:"NOT READY",statusUnavailable:"상태 확인 불가",
    statusSnapshot:"마지막 데이터 기준",metricRegistered:"등록된 SKU",metricCurrent:"현재 카탈로그 SKU",metricSpecs:"스펙 보유 SKU",metricSources:"성공한 카탈로그 소스",
    statusGates:"완성도 검증",statusChanges:"최근 증분 수집",statusChangesEmpty:"증분 수집 결과가 아직 없습니다.",
    statusAudit:"카테고리별 수집 상세 보기",statusAuditNote:"내부 수집 결과의 대조이며, 삼성닷컴 모든 SKU의 독립적인 완전성 검증은 아닙니다.",
    statusTableCategory:"사업부 / 카테고리",statusTableFound:"발견 SKU",statusTableSaved:"저장 SKU",statusTableState:"상태",statusTableLink:"출처",
    statusExplorer:"실제 SKU 데이터 탐색하기 ↗",statusSyncNew:"신규 SKU",statusSyncSpecs:"스펙 업데이트",statusSyncOffers:"가격 변경",statusSyncChecked:"가격 확인",statusSyncRun:"마지막 증분 실행",
    statusError:"데이터를 불러올 수 없습니다. 최신 GitHub 수집 결과를 확인해 주세요.",
    gate_current_catalog_coverage:"카탈로그 내부 대조",gate_no_failed_catalog_sources:"수집 소스 오류 없음",gate_current_specs_complete:"현재 SKU 스펙 확보",gate_support_linkage_complete:"지원 자료 SKU 연결",gate_legacy_ingestion_present:"과거 제품 확보",gate_unresolved_products_zero:"미분류 SKU 없음",
    passed:"통과",pending:"미완료",notRun:"실행 전"
  },
  us: {
    skip:"Skip to content",navLifecycle:"The 4 data types",navDemo:"How it works",navConnect:"Connect MCP",tryMcp:"Use the MCP",
    heroEyebrow:"SAMSUNG.COM DATA FOR AI AGENTS",heroTitle1:"Capture stable facts once.",heroTitle2:"Refresh only what changes.",
    heroDescription:"Specs, prices, inventory and more shouldn't all be crawled the same way. Collect each type on its own schedule and make it accessible through one MCP interface.",
    exploreTypes:"Explore the 4 types",seeExample:"See it in action",heroFoot1:"SKU-first records",heroFoot2:"Sources & freshness",
    visualEyebrow:"DATA ROUTING · CONCEPT",visualSource:"Market-specific product & service data",
    visualA:"Product specifications",visualADesc:"Collect once · reuse",visualAStatus:"KEEP",
    visualB:"FAQs & policies",visualBDesc:"Update only on change",visualBStatus:"DETECT",
    visualC:"Prices & promotions",visualCDesc:"Check on a schedule",visualCStatus:"REFRESH",
    visualD:"Inventory & delivery",visualDDesc:"Requires official live integration",visualDStatus:"CONNECT",visualBottom:"Bring the right data to your AI agent",
    typesEyebrow:"THE FOUR DATA LIFECYCLES",typesTitle1:"Different data.",typesTitle2:"Different collection rules.",
    typesDescription:"We divide the data an AI shopping assistant needs into four types. Select a card to see how it answers a customer's question.",
    aTag:"ONCE",bTag:"ON CHANGE",cTag:"SCHEDULED",dTag:"ON DEMAND",typeStrategy:"COLLECTION RULE",
    aHeading:"Capture once",aDesc:"SKU, model, specifications, size and variant attributes that rarely change",aStrategy:"Build once, reuse",aExample:"e.g. camera specifications",
    bHeading:"Update on change",bDesc:"FAQs, manuals, compatibility and policies that may be revised",bStrategy:"Detect changes, update deltas",bExample:"e.g. a new support FAQ",
    cHeading:"Refresh often",cDesc:"Prices, offers, promotions and selling status that move frequently",cStrategy:"Scheduled freshness checks",cExample:"e.g. today's sale price",
    dHeading:"Query live",dDesc:"Local stock, delivery estimates, personal benefits and order status",dStrategy:"Query official APIs on demand",dExample:"e.g. delivery tomorrow?",
    typeCaveat:"Even type A can need corrections. Type D needs separate authorized real-time APIs and is not part of the current public static-data MCP.",
    demoEyebrow:"INTERACTIVE POC",demoTitle1:"One question.",demoTitle2:"The right data route.",
    demoDescription:"Select a real collected SKU. Explore its stored specifications, linked support resources and verified offers, plus the limits of live APIs.",
    demoChoose:"CHOOSE A QUESTION",demoOptionA:"What are the specs?",demoOptionB:"Are support resources linked?",demoOptionC:"Is there a discount?",demoOptionD:"Can it arrive tomorrow?",
    demoDisclaimer:"Product data is a published mart snapshot. MCP commands are examples, not live invocations; authorized real-time APIs are not connected.",
    screenTitle:"AGENT DATA ROUTE · SIMULATION",screenDemo:"DEMO",screenQuestion:"CUSTOMER QUESTION",screenRoute:"DATA ROUTE",screenOutput:"MCP / NEXT ACTION",
    connectEyebrow:"READY FOR AI AGENTS",connectTitle1:"Stop building scrapers.",connectTitle2:"Start using the data.",
    connectDescription:"Access SKU search, specifications, collected offers and support resources through one interface. The open-source MCP currently runs locally over stdio.",
    connectGuide:"MCP setup guide",connectStatus:"Check collection health",connectCaveat:"※ Coverage and freshness vary by market. Live personal inventory, delivery and order integrations are not included.",
    copyCode:"Copy",copied:"Copied ✓",copyFailed:"Please select the code to copy",terminalFooter:"Node.js 20+ · Local stdio MCP",
    bottomTitle:"Transparent by design.",bottomDescription:"If a dataset is incomplete, we say so. Explore actual coverage, missing SKUs and validation gates.",
    bottomStatus:"View collection status ↗",bottomExplorer:"Explore SKU records ↗",bottomCatalog:"Data mart catalog ↗",statusCatalog:"View mart schema ↗",footerDisclaimer:"Independent community project. Not an official Samsung service.",
    statusEyebrow:"DATA QUALITY · KOREA",statusTitle:"Collection health",statusLead:"Live repo snapshots of crawler coverage and quality. Missing records and failed checks are never presented as complete.",
    backHome:"← Back to home",statusLoading:"Loading data quality status…",statusReady:"READY",statusNotReady:"NOT READY",statusUnavailable:"STATUS UNAVAILABLE",
    statusSnapshot:"Data snapshot",metricRegistered:"Registered SKUs",metricCurrent:"Current catalog SKUs",metricSpecs:"SKUs with specs",metricSources:"Verified catalog sources",
    statusGates:"Readiness checks",statusChanges:"Last incremental sync",statusChangesEmpty:"No incremental run report yet.",
    statusAudit:"See category-level details",statusAuditNote:"Internal reconciliation only; this does not independently certify every Samsung.com SKU.",
    statusTableCategory:"BU / category",statusTableFound:"Discovered SKUs",statusTableSaved:"Stored SKUs",statusTableState:"State",statusTableLink:"Source",
    statusExplorer:"Explore actual SKU data ↗",statusSyncNew:"New SKUs",statusSyncSpecs:"Spec changes",statusSyncOffers:"Offer changes",statusSyncChecked:"Offers verified",statusSyncRun:"Last incremental sync",
    statusError:"Could not load data. Please check the latest GitHub crawl results.",
    gate_current_catalog_coverage:"Internal catalog reconciliation",gate_no_failed_catalog_sources:"No failed catalog sources",gate_current_specs_complete:"Current SKU specifications",gate_support_linkage_complete:"Linked support knowledge",gate_legacy_ingestion_present:"Legacy SKU coverage",gate_unresolved_products_zero:"No unresolved classifications",
    passed:"PASS",pending:"PENDING",notRun:"Not yet run"
  }
};
Object.assign(copy.kr, {demoSkuTitle:"01 · 실제 삼성 제품 선택",demoOriginalSource:"삼성닷컴 원본 보기",metricHarman:"하만 SKU",harmanNotCollected:"수집 전",explorerEyebrow:"SKU-FIRST DATA EXPLORER",explorerTitle:"SKU 데이터 탐색",explorerLead:"수집된 제품 데이터를 조회합니다. 일부 SKU나 스펙은 아직 누락될 수 있습니다.",explorerMarket:"국가",explorerDataset:"데이터 유형",explorerProducts:"제품",explorerPages:"페이지",explorerHistory:"변경 이력",explorerBu:"사업부",explorerAllBu:"전체",explorerSearch:"검색",explorerCaveat:"가격은 최근 검증된 경우에만 표시됩니다. 최종 결제 가격은 아닙니다."});
Object.assign(copy.us, {demoSkuTitle:"01 · SELECT A REAL SAMSUNG SKU",demoOriginalSource:"Official Samsung.com source",metricHarman:"HARMAN SKUs",harmanNotCollected:"Not collected",explorerEyebrow:"SKU-FIRST DATA EXPLORER",explorerTitle:"Explore SKU data",explorerLead:"Browse collected product data. Some SKUs or specs may still be missing.",explorerMarket:"Market",explorerDataset:"Dataset",explorerProducts:"Products",explorerPages:"Pages",explorerHistory:"History",explorerBu:"Business unit",explorerAllBu:"All",explorerSearch:"Search",explorerCaveat:"Prices appear only with recent verification; they are not checkout quotes."});
Object.assign(copy.kr,{
  navOverview:"소개",navData:"데이터",
  navStatus:"데이터 현황",navCatalog:"마트 명세",navRegistry:"AI 마트 설계",navExplorer:"SKU 탐색",
  catalogEyebrow:"DATA MART CATALOG · KOREA",catalogTitle:"데이터 마트 명세서.",
  catalogLead:"우리가 수집한 각 마트의 목적과 저장 필드, 실제 건수, 갱신 정책, 품질 상태를 확인할 수 있습니다. 모든 명세는 저장된 JSONL 파일에서 자동 생성합니다.",
  catalogGoStatus:"전체 수집 현황",catalogGoExplorer:"SKU 데이터 조회",
  catalogSnapshotTitle:"PUBLISHED SNAPSHOT",catalogSnapshotNote:"GitHub에 저장된 데이터 기준입니다. 실시간 재고·주문 API 결과가 아닙니다.",
  catalogStatTables:"데이터 테이블",catalogStatTablesSub:"현재 마트 + 변경 이력",
  catalogStatCurrent:"현재 카탈로그 SKU",catalogStatCurrentSub:"내부 수집 목록 대조 기준",
  catalogStatSpecs:"스펙 보유 현재 SKU",catalogStatSpecRate:"현재 SKU 중 확보율",
  catalogStatSupport:"SKU 연결 지원 자료",catalogStatSupportSub:"실제 제품별 연결 건수",
  catalogPhaseA:"Immutable",catalogPhaseANote:"제품 식별 · 스펙 보존",
  catalogPhaseB:"Versioned",catalogPhaseBNote:"지원 · 분류 변경 관리",
  catalogPhaseC:"Dynamic",catalogPhaseCNote:"가격 · 판매 상태 · 검증 시각",
  catalogPhaseD:"Real-time",catalogPhaseDNote:"별도 공식 API 필요 · 미연동",
  catalogBrowseEyebrow:"DATA DICTIONARY",catalogBrowseTitle:"테이블별 데이터 명세",
  catalogBrowseLead:"테이블을 선택해 실제 행 수, 기본키, 갱신 정책, 컬럼 정의 및 원본 샘플을 살펴보세요.",
  catalogSearchLabel:"테이블 검색",catalogSearchPlaceholder:"테이블 이름 · 필드 검색",catalogAll:"전체",
  catalogLoading:"실제 데이터 명세를 불러오는 중…",catalogCountLabel:"개 테이블",
  catalogNoResults:"조건에 맞는 테이블이 없습니다.",catalogDetailRows:"저장된 행",catalogRowsSuffix:"행",
  catalogDetailGrain:"데이터 단위 (Grain)",catalogDetailKey:"기본키 (PK)",catalogDetailRefresh:"갱신 정책",
  catalogDetailCols:"컬럼 수",catalogDetailJoin:"연결 키",catalogDetailTools:"사용 가능한 MCP 도구",
  catalogFieldsTitle:"컬럼 사전",catalogFieldsUnit:"개 필드",catalogFieldName:"필드명",
  catalogFieldType:"유형",catalogFieldDescription:"설명",catalogFieldFill:"값 채움 비율",
  catalogSampleTitle:"실제 저장 데이터 샘플",catalogCopy:"JSON 복사",catalogCopied:"복사 완료 ✓",
  catalogCopyError:"선택하여 복사해 주세요.",catalogSampleNote:"첫 번째 대표 행을 축약한 예시입니다. 전체 데이터는 GitHub 원본에서 확인하세요.",
  catalogNoSample:"저장된 레코드가 없습니다.",catalogSource:"GitHub 원본",
  catalogLoadFailed:"데이터 명세를 불러오지 못했습니다. GitHub 원본 또는 네트워크를 확인해 주세요.",
  catalogRetry:"다시 시도",catalogReportsEyebrow:"QUALITY & AUDIT REPORTS",
  catalogReportsTitle:"품질 검증 리포트도 함께 공개합니다.",
  catalogReportsLead:"수집 건수뿐 아니라 누락, 최신성 및 챗봇 READY 기준을 확인할 수 있습니다.",
  catalogFootnote:"※ 행 수와 데이터 완성도는 다릅니다. product_specs에는 실제 specs 값이 없는 행도 저장되며, 가격을 표시하려면 refresh_state의 마지막 확인 시각을 검증해야 합니다."
});
Object.assign(copy.us,{
  navOverview:"Overview",navData:"Data",
  navStatus:"Data status",navCatalog:"Mart catalog",navRegistry:"AI mart design",navExplorer:"SKU explorer",
  catalogEyebrow:"DATA MART CATALOG · KOREA",catalogTitle:"Explore the data marts.",
  catalogLead:"Understand what each mart contains, how it's keyed, its refresh strategy, real stored row counts and coverage. The dictionary is generated from committed JSONL records.",
  catalogGoStatus:"Collection health",catalogGoExplorer:"Explore SKUs",
  catalogSnapshotTitle:"PUBLISHED SNAPSHOT",catalogSnapshotNote:"A committed GitHub snapshot, not live stock or order data.",
  catalogStatTables:"Mart datasets",catalogStatTablesSub:"Current marts + version history",
  catalogStatCurrent:"Current catalog SKUs",catalogStatCurrentSub:"Internal catalog reconciliation",
  catalogStatSpecs:"Current SKUs with specs",catalogStatSpecRate:"coverage of current SKUs",
  catalogStatSupport:"SKU-linked support",catalogStatSupportSub:"Linked support records",
  catalogPhaseA:"Immutable",catalogPhaseANote:"SKU identity and captured facts",
  catalogPhaseB:"Versioned",catalogPhaseBNote:"Support and taxonomy updates",
  catalogPhaseC:"Dynamic",catalogPhaseCNote:"Prices, catalog, verification",
  catalogPhaseD:"Real-time",catalogPhaseDNote:"Authorized API needed · unavailable",
  catalogBrowseEyebrow:"DATA DICTIONARY",catalogBrowseTitle:"Per-table definitions",
  catalogBrowseLead:"Select a mart to inspect actual record counts, primary keys, refresh policy, field definitions and a source-linked sample.",
  catalogSearchLabel:"Search tables",catalogSearchPlaceholder:"Find table names or fields",catalogAll:"All tables",
  catalogLoading:"Loading the real data dictionary…",catalogCountLabel:"tables",
  catalogNoResults:"No tables match this search.",catalogDetailRows:"Stored rows",catalogRowsSuffix:"rows",
  catalogDetailGrain:"Record grain",catalogDetailKey:"Primary key",catalogDetailRefresh:"Refresh rule",
  catalogDetailCols:"Field count",catalogDetailJoin:"Related keys",catalogDetailTools:"Associated MCP tools",
  catalogFieldsTitle:"Field dictionary",catalogFieldsUnit:"fields",catalogFieldName:"Field",
  catalogFieldType:"Type",catalogFieldDescription:"Description",catalogFieldFill:"Populated",
  catalogSampleTitle:"Real record sample",catalogCopy:"Copy JSON",catalogCopied:"Copied ✓",
  catalogCopyError:"Select and copy the text.",catalogSampleNote:"A shortened representative stored row. Open the GitHub source for complete records.",
  catalogNoSample:"No records stored yet.",catalogSource:"GitHub source",
  catalogLoadFailed:"Could not load the catalog. Check GitHub source or your network connection.",
  catalogRetry:"Try again",catalogReportsEyebrow:"QUALITY & AUDIT REPORTS",
  catalogReportsTitle:"Quality reports are available too.",
  catalogReportsLead:"Inspect missing records, freshness and the real chatbot readiness gates.",
  catalogFootnote:"※ Row counts are not coverage. The product_specs mart includes empty specs arrays; market-offer prices require timestamp verification in refresh_state."
});

// Canonical sitewide navigation. Changing menu items in individual page HTML
// must not create different header structures at runtime.
const NAVIGATION_ITEMS = Object.freeze([
  { href: "./", key: "navOverview", route: "index.html" },
  { href: "./catalog.html", key: "navData", routes: ["catalog.html","registry.html","status.html"] },
  { href: "./explorer.html", key: "navExplorer", route: "explorer.html" },
  { href: "./#connect", key: "navConnect", hash: "#connect" }
]);
function syncMainNavigation() {
  const page=location.pathname.split("/").pop()||"index.html";
  const home=page==="index.html";
  document.querySelectorAll(".main-nav").forEach(nav => {
    const anchors=[...nav.querySelectorAll(":scope > a")];
    const changed=anchors.length!==NAVIGATION_ITEMS.length ||
      NAVIGATION_ITEMS.some((item,i)=>anchors[i]?.getAttribute("href")!==item.href ||
        anchors[i]?.dataset.i18n!==item.key);
    if(changed) {
      const newLinks=NAVIGATION_ITEMS.map(item => {
        const a=document.createElement("a");
        a.href=item.href;
        a.dataset.i18n=item.key;
        return a;
      });
      nav.replaceChildren(...newLinks);
    }
    nav.setAttribute("aria-label",currentLanguage==="kr"?"주요 메뉴":"Main navigation");
    [...nav.querySelectorAll(":scope > a")].forEach((link,i) => {
      const item=NAVIGATION_ITEMS[i];
      link.textContent=t(item.key);
      const current=item.route===page || item.routes?.includes(page) ||
        (home && item.hash===location.hash);
      if(current)link.setAttribute("aria-current",item.hash?"location":"page");
      else link.removeAttribute("aria-current");
    });
  });
}

let currentLanguage = "kr";
try { const saved = localStorage.getItem("scom_lang"); if (saved === "us" || saved === "kr") currentLanguage = saved; } catch {}
const listeners = new Set();
function t(key) { return copy[currentLanguage]?.[key] || copy.kr[key] || key; }
function applyLanguage(lang) {
  currentLanguage = lang === "us" ? "us" : "kr";
  document.documentElement.lang = currentLanguage === "kr" ? "ko" : "en";
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-lang]").forEach(el => { el.setAttribute("aria-pressed", String(el.dataset.lang === currentLanguage)); });
  syncMainNavigation();
  try { localStorage.setItem("scom_lang", currentLanguage); } catch {}
  listeners.forEach(fn => fn(currentLanguage));\n  const active=document.querySelector(".main-nav a[aria-current]");\n  if(active) revealActiveNavigation(active);
}
window.ScomSite = { t, language: () => currentLanguage, onLanguageChange(fn) { listeners.add(fn); } };
document.querySelectorAll("[data-lang]").forEach(el => el.addEventListener("click", () => applyLanguage(el.dataset.lang)));
function revealActiveNavigation(active){\n  const nav=active.closest(".main-nav");\n  if(!nav)return;\n  const left=active.offsetLeft-nav.offsetLeft;\n  const right=left+active.offsetWidth;\n  if(left<nav.scrollLeft)nav.scrollLeft=left;\n  else if(right>nav.scrollLeft+nav.clientWidth)nav.scrollLeft=right-nav.clientWidth;\n}\nwindow.addEventListener("hashchange",syncMainNavigation);\nwindow.addEventListener("hashchange",()=>{\n  const active=document.querySelector(".main-nav a[aria-current]");\n  if(active)revealActiveNavigation(active);\n});

// The real-record POC has its own controller in poc.js.
const copyButton=document.getElementById("copy-install");
if(copyButton)copyButton.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(document.getElementById("install-code").textContent.trim());copyButton.textContent=t("copied");setTimeout(()=>{copyButton.textContent=t("copyCode");},1800);}catch{copyButton.textContent=t("copyFailed");}});
applyLanguage(currentLanguage);
