/* S.com Data Platform — bilingual KR/US UI. Product/source data stays unchanged. */
(() => {
  "use strict";
  const ko = {
  "Why MCP": "MCP 소개",
  "Data strategy": "데이터 전략",
  "KR Dashboard": "KR 대시보드",
  "Data Explorer": "데이터 탐색",
  "Architecture": "아키텍처",
  "Markets": "국가별 현황",
  "Get started": "시작하기",
  "OPEN · TEXT-FIRST · AGENT-NATIVE": "OPEN · 텍스트 중심 · AI 에이전트",
  "as usable data.": "AI가 활용하는 데이터.",
  "A reusable, SKU-first data layer for AI shopping assistants. Capture enduring product facts once, refresh what changes, and access source-linked answers through MCP.": "AI 쇼핑 챗봇을 위한 SKU 중심 데이터 플랫폼. 변하지 않는 제품 정보는 한 번 수집하고, 변경되는 정보만 갱신합니다. MCP로 출처가 확인되는 데이터를 활용하세요.",
  "Use the MCP": "MCP 사용하기",
  "Why this platform?": "플랫폼 소개",
  "View data health": "데이터 상태 확인",
  "Explore the catalog": "제품 데이터 살펴보기",
  "SKU-first identity": "SKU 중심 식별",
  "Market-aware": "국가별 데이터 관리",
  "Source-linked records": "공식 출처 연결",
  "Incremental by design": "변경분 중심 업데이트",
  "WHY S.COM DATA PLATFORM": "왜 S.COM DATA PLATFORM인가",
  "Stop scraping pages.": "반복 크롤링 대신",
  "Start asking questions.": "바로 데이터를 활용하세요.",
  "Samsung.com spans markets, product categories and thousands of sellable variants. Agents need consistent product identities, reliable source links and an honest view of how fresh the answer is—not another pile of pages.": "삼성닷컴은 국가와 제품군에 따라 서로 다른 SKU와 정보를 제공합니다. AI 에이전트에게 필요한 것은 수많은 웹페이지가 아니라, SKU별로 정리된 정보와 공식 출처, 그리고 데이터의 최신 상태입니다.",
  "01 / FIND": "01 / 검색",
  "One product. Many variants.": "제품 하나, 다양한 SKU.",
  "Color, storage, capacity and region can create distinct SKUs. Follow a clear": "색상, 저장 용량, 크기, 판매 국가에 따라 SKU가 달라집니다. 제품 이름이나 URL로 추측하지 않고",
  "Market → Business Unit → Category → Family → Model → SKU": "국가 → 사업부 → 카테고리 → 제품군 → 모델 → SKU",
  "hierarchy instead of guessing from product names or URLs.": "구조로 정확한 제품을 식별합니다.",
  "Exact SKU lookups": "정확한 SKU 조회",
  "02 / TRUST": "02 / 신뢰",
  "Answers with evidence.": "출처를 확인할 수 있는 답변.",
  "Normalized specs, offers and support resources retain their Samsung.com source URLs. Lifecycle and readiness checks help agents distinguish verified information from gaps.": "제품 스펙, 판매 정보, 고객지원 자료에 삼성닷컴 원본 URL을 연결합니다. 수집 완성도와 검증 상태도 제공해 확인된 정보와 누락된 정보를 구분합니다.",
  "Source-linked data marts": "출처가 연결된 데이터 마트",
  "03 / REUSE": "03 / 재사용",
  "Collect intelligently.": "필요한 데이터만 다시 수집.",
  "Keep product identity and hardware specs, detect changes to knowledge and commerce, and update affected records—without treating every refresh as a full product rebuild.": "제품 식별 정보와 하드웨어 스펙은 유지하고, FAQ나 가격·프로모션 변경만 감지해 해당 데이터만 갱신합니다. 매번 제품 전체를 다시 만들지 않습니다.",
  "Less repeat processing": "중복 수집 최소화",
  "THE DATA LIFECYCLE": "데이터별 수집 전략",
  "Not every field": "모든 데이터를",
  "needs the same clock.": "같은 주기로 수집할 필요는 없습니다.",
  "Four data behaviors, four collection strategies. The result is a persistent product profile with separate freshness rules for the information that can change.": "삼성닷컴 데이터를 변화 특성에 따라 네 가지로 구분합니다. 제품 정보는 안정적으로 보관하고, 자주 바뀌는 데이터에는 별도의 최신성 기준을 적용합니다.",
  "A / IMMUTABLE": "A / 정적 데이터",
  "Capture once": "최초 1회",
  "Product master": "제품 마스터",
  "Identity and stable hardware facts: SKU, model, dimensions, core specifications and variant attributes.": "SKU, 모델명, 크기, 주요 하드웨어 사양, 색상·용량 등 제품의 기본 정보입니다.",
  "Collection": "수집 방식",
  "On discovery; recheck exceptions": "신규 발견 시 수집 · 예외 시 재검증",
  "Store": "저장 방식",
  "Durable SKU registry": "SKU별 영구 보관",
  "B / VERSIONED": "B / 변경 이력 데이터",
  "On change": "변경 시",
  "Knowledge": "제품 지식",
  "FAQs, manuals, support guidance, compatibility, policies and corrected product descriptions.": "FAQ, 사용 설명서, 고객지원 안내, 호환성, 정책, 제품 설명 정정 등입니다.",
  "Check for changes; update deltas": "변경 감지 후 수정분만 갱신",
  "Latest + meaningful versions": "최신본과 주요 변경 이력",
  "C / DYNAMIC": "C / 동적 데이터",
  "Refresh often": "주기적 갱신",
  "Commerce": "판매 정보",
  "Market prices, discounts, promotions, buyability, offers and product lifecycle state.": "국가별 가격, 할인, 프로모션, 구매 가능 여부, 혜택, 제품 판매 상태 등입니다.",
  "Scheduled freshness checks": "정해진 주기로 최신성 확인",
  "Current values + useful history": "현재 값과 필요한 변경 이력",
  "D / REAL-TIME": "D / 실시간 데이터",
  "Integration needed": "별도 연동 필요",
  "Live services": "실시간 서비스",
  "Checkout-specific totals, local inventory, delivery estimates, personalized benefits and orders.": "최종 결제 금액, 매장별 재고, 예상 배송일, 개인별 혜택, 주문 정보 등입니다.",
  "Query authorized live APIs": "권한이 있는 실시간 API 조회",
  "Not inferred from crawled pages": "크롤링 자료로 추측하지 않음",
  "Important:": "중요:",
  "“Capture once” describes the default enrichment strategy, not a guarantee that facts never need correction. Live inventory, delivery, account and order APIs are": "‘최초 1회 수집’은 기본 운영 원칙이며, 정보 정정이 없다는 뜻은 아닙니다. 실시간 재고·배송·계정·주문 API는 현재 공개된 정적 데이터 MCP에",
  "not included": "포함되어 있지 않으며",
  "in the public static-data MCP today; they require separate authorized integrations.": "별도의 정식 API 연동이 필요합니다.",
  "HOW IT WORKS": "수집부터 MCP까지",
  "New SKUs in.": "새로운 SKU는 추가하고,",
  "Only changes move.": "달라진 정보만 갱신합니다.",
  "Discovery is separate from enrichment. Known products keep their stable records while targeted collection focuses on new variants and data whose freshness actually matters.": "신규 SKU 탐색과 상세 데이터 수집을 분리합니다. 기존 제품의 정적 정보는 유지하면서 신규 모델과 최신성이 중요한 데이터만 선택적으로 갱신합니다.",
  "Discover": "신규 제품 탐색",
  "Find market SKUs & variants": "국가별 SKU와 옵션 검색",
  "Enrich once": "최초 상세 수집",
  "Build source-linked master data": "공식 출처 기반 마스터 구축",
  "Check changes": "변경 감지",
  "Observe support & commerce": "고객지원·판매 정보 확인",
  "Update marts": "데이터 마트 갱신",
  "Write only meaningful differences": "변경된 정보만 반영",
  "Serve via MCP": "MCP 제공",
  "Let agents query normalized data": "AI 에이전트가 구조화된 데이터 조회",
  "EXAMPLE · ONE SKU OVER TIME": "예시 · 동일 SKU의 변화",
  "The specs stay. The offer changes.": "스펙은 그대로, 가격과 혜택만 변경.",
  "Illustrative workflow, not a claim about a specific product or a live offer.": "설명을 위한 예시이며 실제 제품의 현재 혜택을 의미하지 않습니다.",
  "New SKU discovered": "신규 SKU 발견",
  "Create Product Master": "제품 마스터 생성",
  "Price changes": "판매 가격 변경",
  "Update Commerce only": "판매 정보만 업데이트",
  "FAQ gets revised": "FAQ 내용 수정",
  "Update Knowledge only": "제품 지식만 업데이트",
  "Delivery is asked": "배송일 문의",
  "Requires live integration": "실시간 연동 필요",
  "BUILT FOR AGENT DEVELOPERS": "AI 에이전트 개발자를 위해",
  "Give your agent": "AI 에이전트에",
  "better building blocks.": "믿고 활용할 데이터를 연결하세요.",
  "Use structured, market-aware MCP tools instead of parsing Samsung.com pages inside every conversation. Capabilities depend on what has been collected and verified in each market.": "매번 삼성닷컴 페이지를 분석하는 대신, 국가별로 정규화된 데이터를 MCP로 조회하세요. 사용 가능한 정보는 국가별 수집·검증 현황에 따라 달라집니다.",
  "“Find the exact model and its specs.”": "“이 제품의 정확한 모델과 스펙은?”",
  "Product discovery & comparison": "제품 탐색 및 비교",
  "Search by market, resolve a SKU, and retrieve normalized product specifications.": "국가별 제품을 검색하고 SKU를 확인한 뒤 정리된 스펙을 조회합니다.",
  "“What offer is recorded for this SKU?”": "“이 SKU의 최신 수집 가격은?”",
  "Commerce context": "가격과 구매 혜택",
  "Read the latest collected offer and changes over time—not a guaranteed checkout quote.": "최근 수집된 판매 혜택과 변경 이력을 확인합니다. 실제 결제 금액을 보장하지는 않습니다.",
  "“Where is the official support information?”": "“공식 설명서는 어디에서 볼 수 있지?”",
  "Knowledge & provenance": "고객지원 및 출처",
  "Retrieve manuals and support resources with their original source references.": "매뉴얼과 고객지원 정보를 원문 출처와 함께 찾아줍니다.",
  "See the actual coverage before using it.": "사용 전에 데이터 커버리지를 확인하세요.",
  "An incomplete crawl is not a complete catalog. Readiness checks surface missing SKUs, failed sources and support gaps.": "일부 수집 성공이 전체 제품 수집 완료를 뜻하지는 않습니다. 누락 SKU, 수집 실패, 고객지원 데이터 부족 여부를 확인할 수 있습니다.",
  "Check KR readiness": "KR 준비 상태 확인",
  "Connect with MCP ↗": "MCP 연결하기 ↗",
  "KR · CATALOG HEALTH": "KR · 카탈로그 수집 현황",
  "Data dashboard": "데이터 대시보드",
  "Monitor SKU discovery, category coverage, failed sources and chatbot readiness. All figures are loaded from the latest published crawl data.": "신규 SKU 탐색, 카테고리별 수집률, 수집 실패 및 챗봇 준비 상태를 확인합니다. 수치는 공개된 최신 수집 결과를 사용합니다.",
  "Loading latest snapshot…": "최신 수집 데이터 불러오는 중…",
  "Checking…": "확인 중…",
  "Incremental data sync": "증분 데이터 동기화",
  "Awaiting first incremental crawl. This is separate from chatbot READY.": "첫 증분 크롤링 결과를 기다리는 중입니다. 챗봇 READY 상태와는 별개입니다.",
  "Product profiles/specs are retained; verified offers and commerce update independently. A successful sync alone does not certify SKU completeness.": "제품 프로필과 스펙은 유지하고, 검증된 판매 정보는 독립적으로 갱신합니다. 동기화 성공만으로 전체 SKU 수집이 보장되지는 않습니다.",
  "Catalog verification": "카탈로그 검증",
  "Checking whether all official category sources were successfully enumerated…": "공식 카테고리 출처의 수집 상태 확인 중…",
  "SKU counts below compare the crawler’s discovered IDs against its stored database. Matching counts do": "아래 SKU 수치는 탐색한 SKU와 저장된 데이터베이스를 비교한 결과입니다. 수치가 같다고",
  "not": "해서",
  "independently prove that every Samsung.com SKU was discovered.": "삼성닷컴의 모든 SKU가 발견되었다는 뜻은 아닙니다.",
  "Category coverage": "카테고리별 수집 현황",
  "Official catalog source → discovered SKU → database SKU": "공식 카탈로그 → 탐색한 SKU → DB에 저장된 SKU",
  "All business units": "전체 사업부",
  "All statuses": "전체 상태",
  "Failed": "실패",
  "OK": "정상",
  "Business unit / Category": "사업부 / 카테고리",
  "Discovered": "탐색",
  "DB": "DB",
  "Missing": "누락",
  "Unexpected": "추가",
  "Status": "상태",
  "Source": "출처",
  "Readiness gates": "READY 판정 항목",
  "Every gate must pass before READY: TRUE.": "모든 검증 항목이 통과해야 READY: TRUE가 됩니다.",
  "Failed sources": "수집 실패 출처",
  "Failed categories must not be interpreted as zero products.": "수집에 실패한 카테고리를 제품 0개로 판단하면 안 됩니다.",
  "New product monitoring": "신제품 변경 모니터링",
  "SKU change comparisons require verified previous and current snapshots.": "SKU 변경 비교에는 검증된 이전·현재 수집본이 필요합니다.",
  "No comparison history available yet.": "아직 비교할 변경 이력이 없습니다.",
  "DATA EXPLORER": "데이터 탐색",
  "Korea SKU Catalog": "한국 SKU 카탈로그",
  "Samsung Korea products indexed by SKU. Browse BU → Category → Product Family → Model → SKU, with variant attributes and source evidence.": "삼성닷컴 한국 제품을 SKU별로 탐색합니다. 사업부 → 카테고리 → 제품군 → 모델 → SKU 순서로 제품 옵션과 공식 출처를 확인하세요.",
  "Market": "국가",
  "KR · Korea": "KR · 한국",
  "Dataset": "데이터 종류",
  "Products": "제품",
  "Pages": "페이지",
  "History": "변경 이력",
  "Business Unit": "사업부",
  "All BU": "전체 사업부",
  "DA · Digital Appliances": "DA · 생활가전",
  "VD · Visual Display": "VD · 영상디스플레이",
  "MX · Mobile eXperience": "MX · 모바일",
  "Search": "검색",
  "Loading dataset…": "데이터 불러오는 중…",
  "Show more": "더 보기",
  "Normalize": "데이터 정규화",
  "Transform public pages into SKU-first product, support and commerce records with source URLs.": "공개 웹페이지를 SKU 중심의 제품·고객지원·판매 데이터로 정리하고 출처 URL을 연결합니다.",
  "Version": "변경 이력 관리",
  "Preserve stable specs, check changing fields, and retain useful versions without rebuilding everything.": "제품 스펙은 유지하면서 변경된 필드를 점검하고 필요한 이력만 저장합니다.",
  "Serve": "MCP로 제공",
  "Expose searchable local data marts through MCP; live personal services need separate connections.": "MCP에서 로컬 데이터 마트를 검색합니다. 개인별 실시간 서비스는 별도 연동이 필요합니다.",
  "Find new product variants and source evidence by market; known SKU identities remain stable.": "국가별 신규 SKU와 공식 출처를 찾고 기존 SKU의 식별 정보는 유지합니다.",
  "LIVE DATASET": "공개 데이터셋",
  "Market status": "국가별 데이터 현황",
  "Loading repository data…": "저장소 데이터 불러오는 중…",
  "MODEL CONTEXT PROTOCOL · GET STARTED": "MODEL CONTEXT PROTOCOL · 시작하기",
  "One interface.": "하나의 MCP로,",
  "Reusable data.": "다양한 데이터를 활용하세요.",
  "Clone the public repository and start the local stdio MCP server. Your agent can use structured product search, specifications, collected market offers, version history and support lookup instead of maintaining its own scraper.": "공개 GitHub 저장소를 복제하고 로컬 MCP 서버를 실행하세요. 별도 크롤러 없이 제품 검색, 스펙, 수집된 가격·혜택, 변경 이력, 고객지원 정보를 조회할 수 있습니다.",
  "Open-source": "오픈소스",
  "Local stdio MCP": "로컬 stdio MCP",
  "Text-first": "텍스트 중심",
  "Source attribution": "공식 출처 제공",
  "This is an independent community project, not an official Samsung service. Data completeness and freshness vary by market; inspect the": "이 플랫폼은 삼성 공식 서비스가 아닌 독립 커뮤니티 프로젝트입니다. 국가별로 수집 완성도와 최신성이 다르므로 사용 전",
  "readiness dashboard": "수집 준비 상태 대시보드",
  "before relying on results.": "를 확인하세요.",
  "Open setup guide on GitHub ↗": "GitHub 설치 가이드 보기 ↗",
  "Terminal · Quick start": "터미널 · 빠른 시작",
  "Connect the local stdio command in your MCP-compatible client. No live stock, checkout or order API is included.": "MCP를 지원하는 클라이언트에 로컬 stdio 명령을 연결하세요. 실시간 재고·결제·주문 API는 포함되어 있지 않습니다.",
  "DETAIL": "상세 보기",
  "Data detail": "데이터 상세",
  "Open source": "원문 보기",
  "Close": "닫기",
  "Community project. Source records link back to Samsung.com.": "커뮤니티 프로젝트 · 데이터 원본은 삼성닷컴에 연결됩니다.",
  "Git-backed · zero-cost-first": "Git 기반 · 최소 비용 설계",
  "Search categories": "카테고리 검색",
  "Search products…": "제품 검색…",
  "Search page titles or text…": "페이지 제목·내용 검색…",
  "Search product history…": "제품 변경 이력 검색…",
  "Search products": "제품 검색",
  "Select business unit": "사업부 선택",
  "Select dataset": "데이터 종류 선택",
  "Primary navigation": "주요 메뉴",
  "Close detail": "상세 보기 닫기",
  "Discovered SKU": "발견한 SKU",
  "DB current SKU": "DB 최신 SKU",
  "Verified sources": "검증된 출처",
  "Current catalog coverage": "현재 카탈로그 커버리지",
  "No failed catalog sources": "카탈로그 수집 실패 없음",
  "Current SKU specifications": "현재 SKU 스펙 완성",
  "Support linkage": "고객지원 정보 연결",
  "Legacy ingestion": "과거 제품 수집",
  "No unresolved / OTHER products": "미분류 / OTHER 제품 없음",
  "PASS": "통과",
  "FAIL": "실패",
  "DATA UNAVAILABLE": "데이터 없음",
  "No failed sources": "수집 실패 출처 없음",
  "No matching categories": "일치하는 카테고리가 없습니다.",
  "complete": "완료",
  "incomplete": "미완료",
  "Open ↗": "열기 ↗",
  "Previous": "이전",
  "Current": "현재",
  "New": "신규",
  "Removed": "제외",
  "Category": "카테고리",
  "Changes compared with previous verified snapshot. Review new SKU IDs against official launch announcements.": "검증된 직전 수집본과 비교했습니다. 새로운 SKU는 공식 출시 공지와 대조하세요.",
  "Coverage/readiness data unavailable": "카탈로그 및 준비 상태 데이터를 불러올 수 없습니다.",
  "Internal SKU reconciliation: PASS · Independent inventory verification: NOT YET VERIFIED": "내부 SKU 대조: 통과 · 외부 기준 전체 목록 검증: 미완료",
  "All configured category sources reconciled internally. An independent source inventory is still needed to certify full Samsung.com coverage.": "설정된 카테고리 출처는 내부 대조를 통과했습니다. 전체 삼성닷컴 제품을 검증하려면 별도의 독립적인 목록이 필요합니다.",
  "Full catalog coverage cannot be certified until failed sources are recovered and independently checked.": "실패한 출처를 복구하고 독립적으로 검증하기 전에는 전체 카탈로그 완성도를 보장할 수 없습니다.",
  "Snapshot:": "수집 기준:",
  "New SKU profiles": "신규 SKU 프로필",
  "Spec updates": "스펙 업데이트",
  "Offer changes": "혜택 변경",
  "Offers checked": "혜택 검증",
  "No completed incremental crawl": "완료된 증분 수집이 없습니다.",
  "Last verified crawl:": "최근 검증된 수집:",
  "URLs attempted:": "요청한 URL:",
  "crawl failures:": "수집 실패:",
  "Incremental mode not run yet —": "증분 수집이 아직 실행되지 않았습니다 —",
  "pages": "페이지",
  "products": "제품",
  "current": "현재",
  "seed": "초기 대상",
  "Configured · awaiting first crawl": "설정 완료 · 첫 수집 대기",
  "Dataset status is not available yet:": "데이터셋 상태를 확인할 수 없습니다:",
  "Market registry unavailable.": "국가 목록을 불러올 수 없습니다.",
  "Loading current snapshot…": "현재 수집본을 불러오는 중…",
  "Could not load this dataset:": "데이터를 불러올 수 없습니다:",
  "Dataset unavailable.": "데이터를 사용할 수 없습니다.",
  "matching tracked products": "개의 검색된 제품 이력",
  "tracked products": "개의 제품 이력",
  "total": "전체",
  "saved versions": "저장된 버전",
  "Latest crawl": "최근 수집",
  "Captured": "수집일",
  "in current snapshot": "현재 수집본",
  "No matching records. Try another keyword.": "검색 결과가 없습니다. 다른 검색어를 입력하세요.",
  "First captured": "최초 수집",
  "Unnamed product": "이름 없는 제품",
  "Waiting for next change": "다음 변경을 기다리는 중",
  "Product Family": "제품군",
  "Family": "제품군",
  "Model": "모델",
  "Brand": "브랜드",
  "Lifecycle": "판매 상태",
  "Price": "가격",
  "Availability": "구매 가능 여부",
  "Product key": "제품 키",
  "Catalog source": "카탈로그 출처",
  "Source URL": "원문 URL",
  "Spec source": "스펙 출처",
  "Description": "설명",
  "Page ID": "페이지 ID",
  "Content hash": "콘텐츠 해시",
  "Canonical URL": "대표 URL",
  "Variants": "옵션",
  "Spec": "스펙",
  "Specifications": "스펙",
  "Structured specs have not been captured for this product yet.": "이 제품의 구조화된 스펙은 아직 수집되지 않았습니다.",
  "Source type:": "출처 종류:",
  "PRODUCT RECORD": "제품 정보",
  "PAGE RECORD": "페이지 정보",
  "PRODUCT HISTORY": "제품 변경 이력",
  "Product history": "제품 변경 이력",
  "Identity / spec version": "제품 식별 / 스펙 버전",
  "Fingerprint changed": "데이터 지문이 변경됨",
  "Saved versions": "저장된 버전",
  "Change events": "변경 횟수",
  "Latest captured": "최근 수집",
  "Only the initial identity/spec version exists right now. Price and commerce history are kept separate and are exposed only for products verified as currently sellable.": "현재는 최초 제품 정보 버전만 있습니다. 가격 및 판매 정보 변경 이력은 별도 보관되며 현재 판매 중으로 검증된 제품에만 제공됩니다.",
  "Initial capture": "최초 수집",
  "Name": "이름",
  "removed": "삭제됨",
  "unverified": "미검증",
  "current sellable": "현재 판매 중",
  "current out of stock": "현재 품절",
  "current not directly sellable": "온라인 구매 불가",
  "discontinued": "단종",
  "legacy supported": "과거 제품 · 지원 중",
  "legacy archived": "과거 제품 · 보관",
  "History ·": "이력 ·",
  "Page ·": "페이지 ·",
  "version": "버전",
  "versions": "버전",
  "latest change": "최근 변경",
  "latest changes": "최근 변경",
  "SKU": "SKU",
  "Product": "제품",
  "Page": "페이지",
  "Source type": "출처 종류",
  "mart target URLs": "수집 대상 URL",
  "out of stock": "품절",
  "in stock": "재고 있음",
  "InStock": "재고 있음",
  "OutOfStock": "품절",
  "PreOrder": "예약 주문",
  "SoldOut": "품절",
  "Preorder": "예약 주문",
  "READY: TRUE": "READY: TRUE",
  "READY: FALSE": "READY: FALSE"
};
  const dictionary = new Map(Object.entries(ko));
  const savedText = new WeakMap();
  const savedAttributes = new WeakMap();
  const attrs = ["placeholder", "aria-label", "title"];
  const skipped = "script,style,pre,code,textarea,[data-i18n-ignore]";
  const allowed = ["kr", "us"];
  const localeFor = language => language === "kr" ? "ko-KR" : "en-US";

  function storePreference(language) {
    try { localStorage.setItem("scom-language", language); } catch {}
  }
  function initialLanguage() {
    const query = new URLSearchParams(location.search).get("lang")?.toLowerCase();
    if (allowed.includes(query)) return query;
    let stored;
    try { stored = localStorage.getItem("scom-language"); } catch {}
    if (allowed.includes(stored)) return stored;
    return navigator.language?.toLowerCase().startsWith("ko") ? "kr" : "us";
  }
  let language = initialLanguage();

  function phrase(value) {
    const input = String(value).trim();
    if (!input || language !== "kr") return input;
    if (dictionary.has(input)) return dictionary.get(input);
    const replacePrefixes = [
      ["Dataset status is not available yet:", "데이터셋 상태를 확인할 수 없습니다:"],
      ["Could not load this dataset:", "데이터를 불러올 수 없습니다:"],
      ["Source type:", "출처 종류:"],
      ["Snapshot:", "수집 기준:"],
      ["Last verified crawl:", "최근 검증된 수집:"],
      ["Incremental mode not run yet —", "증분 수집이 아직 실행되지 않았습니다 —"],
      ["Internal SKU reconciliation: INCOMPLETE ·", "내부 SKU 대조: 미완료 ·"]
    ];
    for (const [en, kr] of replacePrefixes) {
      if (input.startsWith(en)) return kr + input.slice(en.length);
    }
    const simple = [
      [/^(\\d+) failed categories · (\\d+) categories with SKU mismatches$/, "$1개 카테고리 수집 실패 · $2개 카테고리 SKU 불일치"],
      [/^(\\d+) \\/ (\\d+) mart target URLs · (.+)$/, "수집 대상 URL $1 / $2 · $3"],
      [/^(\\d+) pages · (\\d+) products$/, "$1페이지 · $2개 제품"],
      [/^(\\d+) products$/, "$1개 제품"],
      [/^(\\d+) specs$/, "스펙 $1개"],
      [/^(\\d+) matching tracked products · (\\d+) total$/, "일치하는 제품 이력 $1개 · 전체 $2개"],
      [/^(\\d+) tracked products · (\\d+) saved versions$/, "제품 이력 $1개 · 저장된 버전 $2개"],
      [/^(\\d+) matching (products|pages) · (\\d+) total$/, "검색 결과 $1개 · 전체 $3개"],
      [/^(\\d+) (products|pages) in current snapshot$/, "현재 수집본 $1개"],
      [/^(\\d+) versions?$/, "버전 $1개"],
      [/^(\\d+) latest changes?$/, "최근 변경 $1건"],
      [/^First captured (.+)$/, "최초 수집 $1"],
      [/^Latest crawl (.+)$/, "최근 수집 $1"],
      [/^Captured (.+)$/, "수집일 $1"],
      [/^Source type: (.+)$/, "출처 종류: $1"],
      [/^Family (.+)$/, "제품군 $1"],
      [/^Model (.+)$/, "모델 $1"],
      [/^History · (.+)$/, "이력 · $1"],
      [/^Page · (.+)$/, "페이지 · $1"],
      [/^(.+) \\/ (complete|incomplete)$/, (_, status) => " / " + (status === "complete" ? "완료" : "미완료")],
      [/^(.+) — no readiness claim can be made\\.$/, "$1 — 데이터 검증 상태를 판정할 수 없습니다."]
    ];
    for (const [re, replacement] of simple) {
      if (re.test(input)) return input.replace(re, replacement);
    }
    return input;
  }

  function translateText(node) {
    if (!node.parentElement || node.parentElement.closest(skipped)) return;
    let saved = savedText.get(node);
    const current = node.nodeValue;
    if (!saved || (current !== saved.applied && current !== saved.original)) {
      saved = { original: current, applied: current };
    }
    const matches = saved.original.match(/^(\\s*)([\\s\\S]*?)(\\s*)$/);
    if (!matches) return;
    const [, before, core, after] = matches;
    const replacement = before + (language === "kr" ? phrase(core) : core) + after;
    saved.applied = replacement;
    savedText.set(node, saved);
    if (node.nodeValue !== replacement) node.nodeValue = replacement;
  }

  function translateAttrs(element) {
    if (element.matches(skipped) || element.closest("[data-i18n-ignore]")) return;
    let saved = savedAttributes.get(element) || {};
    for (const attr of attrs) {
      if (!element.hasAttribute(attr)) continue;
      const current = element.getAttribute(attr);
      if (!saved[attr] || (current !== saved[attr].applied && current !== saved[attr].original)) {
        saved[attr] = { original: current, applied: current };
      }
      const translated = language === "kr" ? phrase(saved[attr].original) : saved[attr].original;
      saved[attr].applied = translated;
      if (current !== translated) element.setAttribute(attr, translated);
    }
    savedAttributes.set(element, saved);
  }

  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateText(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.matches(skipped) || root.closest("[data-i18n-ignore]")) return;
    translateAttrs(root);
    for (const element of root.querySelectorAll("*")) translateAttrs(element);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateText(node);
  }

  function drawSwitch() {
    document.documentElement.lang = localeFor(language).slice(0, 2);
    for (const button of document.querySelectorAll("[data-language]")) {
      const active = button.dataset.language === language;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("active", active);
    }
  }

  function setLanguage(next) {
    if (!allowed.includes(next)) return;
    language = next;
    storePreference(language);
    drawSwitch();
    translateTree(document.body);
    window.dispatchEvent(new CustomEvent("scom:languagechange", { detail: { language } }));
  }

  // Data views are assembled asynchronously; translate newly rendered UI too.
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "characterData") translateText(record.target);
      if (record.type === "attributes") translateAttrs(record.target);
      if (record.type === "childList") {
        for (const node of record.addedNodes) translateTree(node);
      }
    }
  });

  window.ScomI18n = {
    language: () => language,
    locale: () => localeFor(language),
    phrase,
    setLanguage
  };
  document.querySelectorAll("[data-language]").forEach(button => {
    button.addEventListener("click", () => setLanguage(button.dataset.language));
  });
  drawSwitch();
  translateTree(document.body);
  observer.observe(document.body, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: attrs
  });
})();
