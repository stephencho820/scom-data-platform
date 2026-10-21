/**
 * GitHub Pages customer-shopping demo.
 *
 * Static, deterministic, fully browser-side; NOT an LLM, remote API, or MCP server.
 * Uses the source-linked KR catalog snapshot produced by build-demo-data.mjs.
 * Customer facts never come from model memory or historical price datasets.
 */

const OFFICIAL = "www.samsung.com";
const PRICE_TTL_MS = 36 * 3600 * 1000;
const isOfficial = value => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname === OFFICIAL;
  } catch { return false; }
};
export function normalizeTerm(s = "") {
  return String(s).toLowerCase().normalize("NFKC")
    .replace(/galaxy|갤럭시/gi, "")
    .replace(/z(?=flip|fold)/gi, "")
    .replace(/flip/gi, "플립")
    .replace(/fold/gi, "폴드")
    .replace(/[^0-9a-z가-힣]/gi, "");
}
function searchable(p) {
  return normalizeTerm([
    p.name, p.sku, p.model, p.category,
    p.variants && JSON.stringify(p.variants)
  ].join(" "));
}
function isSaleCandidate(p) {
  return Boolean(p && p.lifecycle === "current_sellable" &&
    p.category === "smartphones" && isOfficial(p.source_url) &&
    /^[A-Za-z0-9-]{5,80}$/.test(p.sku || ""));
}
export function currentPrice(p, now = Date.now()) {
  const offer = p?.offer;
  if (!isSaleCandidate(p)) return { status: "not_verified_sellable", amount: null };
  const timestamp = Date.parse(offer?.checked_at || "");
  const amount = Number(String(offer?.price || "").replace(/,/g, ""));
  if (!offer || !isOfficial(offer.source_url) ||
      !Number.isFinite(amount) || amount <= 0 || !offer.currency) {
    return { status: "unavailable", amount: null };
  }
  if (!Number.isFinite(timestamp) || timestamp > now ||
      now - timestamp > PRICE_TTL_MS) {
    return { status: "stale_or_unverified", amount: null };
  }
  return {
    status: "verified_recently", amount, currency: offer.currency,
    verified_at: offer.checked_at, source_url: offer.source_url,
    price_type: "observed_site_price_not_verified_msrp"
  };
}
export function toCustomerCard(p, now = Date.now()) {
  return {
    sku: p.sku, name: p.name, model: p.model,
    category: p.category, lifecycle_status: p.lifecycle,
    product_url: p.source_url,
    spec_count: Array.isArray(p.specs) ? p.specs.length : 0,
    specs: Array.isArray(p.specs) ? p.specs : [],
    spec_status: Array.isArray(p.specs) && p.specs.length ?
      "collected_unverified" : "missing",
    price: currentPrice(p, now)
  };
}
export function searchCatalog(products, query = "", opts = {}) {
  const now = opts.now ?? Date.now();
  const limit = Math.min(30, Math.max(1, Number(opts.limit) || 12));
  const normalized = normalizeTerm(query);
  const exact = String(query || "").trim().toUpperCase();
  const candidates = (products || []).filter(isSaleCandidate)
    .filter(p => !normalized || searchable(p).includes(normalized) ||
      String(p.sku).toUpperCase() === exact)
    .map(p => toCustomerCard(p, now));
  return { status: "ok", matched: candidates.length, products: candidates.slice(0, limit) };
}
export function extractBudget(text) {
  const cleaned = String(text).replace(/,/g, "");
  const man = cleaned.match(/(\d+(?:\.\d+)?)\s*만\s*원?/);
  if (man) return Math.round(Number(man[1]) * 10000);
  const won = cleaned.match(/(\d{5,9})\s*원/);
  return won ? Number(won[1]) : null;
}
function pickWords(text) {
  const input = String(text || "");
  if (/\bSM-[A-Z0-9-]{4,}\b/i.test(input)) return input.match(/\bSM-[A-Z0-9-]{4,}\b/i)[0];
  if (/플립|flip/i.test(input)) return "플립";
  if (/폴드|fold/i.test(input)) return "폴드";
  if (/s\d{2}/i.test(input)) return input.match(/s\d{2}/i)[0];
  if (/갤럭시|galaxy/i.test(input)) return "갤럭시";
  return "";
}
function event(name, parameters, rows, now) {
  const first = rows?.[0];
  return {
    name, parameters,
    result_status: rows?.length ? "source_linked_partial" : "no_verified_match",
    result_count: rows?.length ?? 0,
    source_url: first?.product_url || null,
    price_verified_at: first?.price?.verified_at || null,
    execution: "in_browser_static_demo"
  };
}
function formatPrice(p) {
  if (p.price.status !== "verified_recently")
    return "최근 검증된 판매가격 없음 (삼성닷컴에서 확인 필요)";
  return Number(p.price.amount).toLocaleString("ko-KR") +
    " " + p.price.currency + " (수집 시점의 사이트 표시가, 공시가 아님)";
}
function renderFacts(p, max = 6) {
  if (!p.specs.length) return "수집·정규화된 스펙이 없어 사양을 확인할 수 없습니다.";
  return p.specs.slice(0, max).map(s =>
    "• " + (s.name || "스펙") + ": " + s.value +
    (s.unit ? " " + s.unit : "")).join("\n");
}
function dedupModel(cards, limit) {
  const seen = new Set();
  return cards.filter(p => {
    const key = normalizeTerm(p.name) || p.sku;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, limit);
}
function reply(answer, cards, events, extra = {}) {
  return {
    answer,
    products: cards.slice(0, 4),
    developer: {
      mode: "GitHub Pages browser-only rule-based POC; no LLM, no remote MCP",
      data_source: "Published KR SKU snapshot from Samsung.com crawler",
      tools: events, ...extra
    }
  };
}
export function runDemoQuestion(question, snapshot, now = Date.now()) {
  const text = String(question || "").trim();
  const all = Array.isArray(snapshot?.products) ? snapshot.products : [];
  if (!all.length) {
    return reply("카탈로그 스냅샷을 불러오지 못했습니다. 현재 제품 정보를 답변할 수 없습니다.", [], []);
  }
  const q = pickWords(text);
  const isCompare = /비교|차이|\bvs\.?\b|versus/i.test(text);
  const isSpecs = /스펙|사양|배터리|카메라|화면|디스플레이|저장|메모리|성능|ram|규격/i.test(text);
  const isPrice = /가격|공시가|얼마|판매가|할인|이하|예산/i.test(text);
  const isInventory = /재고|입고|배송|주문|구매할 수|배송비/i.test(text);
  const events = [];
  if (isInventory) {
    return reply("실시간 재고·배송·주문 시스템이 연결되지 않았습니다. 실제 구매 가능 여부는 삼성닷컴 공식 제품 페이지에서 확인해 주세요.", [], [
      event("check_live_availability", { market: "kr" }, [], now)
    ]);
  }

  const exacts = Array.from(new Set((text.match(/\bSM-[A-Z0-9-]{4,}\b/gi) || [])
    .map(x => x.toUpperCase())));
  if (isCompare) {
    const selected = [];
    if (exacts.length >= 2) {
      for (const sku of exacts.slice(0, 2)) {
        const raw = all.find(p => p.sku?.toUpperCase() === sku && isSaleCandidate(p));
        if (raw) selected.push(toCustomerCard(raw, now));
      }
    } else if (/플립|flip/i.test(text) && /폴드|fold/i.test(text)) {
      for (const term of ["플립", "폴드"]) {
        const matches = searchCatalog(all, term, { now, limit: 30 }).products;
        const best = matches.find(p => p.spec_count > 0) || matches[0];
        if (best) selected.push(best);
      }
    }
    events.push(event("compare_products", {
      market: "kr", skus: selected.map(p => p.sku), requested: text.slice(0, 150)
    }, selected, now));
    if (selected.length < 2) return reply(
      "비교할 두 개의 정확한 SKU를 확인하지 못했습니다. 수집된 제품 중 두 SKU를 지정해 주세요.", selected, events);
    const answer = selected.map(p =>
      p.name + " (" + p.sku + ")\n" + renderFacts(p, 5) + "\n" + formatPrice(p))
      .join("\n\n────────────────\n\n") +
      "\n\n※ 현재 수집된 개별 SKU 2개만 비교한 결과입니다. 다른 옵션·국가 모델의 차이는 별도 확인이 필요합니다.";
    return reply(answer, selected, events);
  }
  const budget = extractBudget(text);
  const searchTerm = q || (/스마트폰|핸드폰|휴대폰|폰/i.test(text) ? "" : "갤럭시");
  const results = searchCatalog(all, searchTerm, { now, limit: 30 });
  events.push(event("search_products", { market: "kr", query: searchTerm,
    category: "smartphones", max_price: budget }, results.products, now));
  if (!results.products.length) return reply(
    "현재 수집된 한국 스마트폰 SKU에서 일치하는 제품을 확인하지 못했습니다. 검색어 또는 정확한 SKU로 다시 찾아주세요.", [], events);

  const capacity = text.match(/(\d{2,4})\s*(gb|tb)/i);
  let candidates = results.products;
  if (capacity) {
    const term = capacity[1] + capacity[2].toLowerCase();
    candidates = candidates.filter(p => {
      const source = all.find(x => x.sku === p.sku);
      return normalizeTerm([p.name, source?.variants && JSON.stringify(source.variants)].join(" ")).includes(term);
    });
    if (!candidates.length) return reply(
      "수집 데이터에서 요청한 저장 용량이 해당 SKU에 연결되었는지 확인되지 않았습니다. 정확한 모델 코드로 검색해 주세요.", [], events);
  }
  if (isPrice) {
    events.push(event("get_product_price", { market: "kr",
      candidate_skus: candidates.slice(0, 4).map(p => p.sku) }, candidates.slice(0, 4), now));
    const valid = candidates.filter(p => p.price.status === "verified_recently");
    const within = budget == null ? valid : valid.filter(p =>
      p.price.currency === "KRW" && p.price.amount <= budget);
    if (!within.length) return reply(
      budget != null ?
        "요청한 예산 이하의 제품을 현재 유효한 가격 근거로 확인할 수 없습니다. 가격이 없거나 갱신 기한이 지난 SKU는 추천에서 제외했습니다." :
        "해당 제품의 최신 검증된 가격을 확인할 수 없습니다. 공시가를 추정하지 않으며 삼성닷컴에서 직접 확인할 수 있습니다.",
      dedupModel(candidates, 4), events);
    const chosen = dedupModel(within, 4);
    return reply("수집 데이터에서 최근 검증된 사이트 표시가격입니다. 공식 공시가(MSRP)로 검증된 값은 아닙니다.\n\n" +
      chosen.map(p => "• " + p.name + " (" + p.sku + "): " + formatPrice(p)).join("\n") +
      "\n\n※ 실시간 결제가격·재고·프로모션 적용 여부는 공식 구매 페이지에서 확인해 주세요.",
      chosen, events);
  }
  if (isSpecs) {
    const chosen = candidates.find(p => p.spec_count > 0) || candidates[0];
    events.push(event("get_product_specs", { market: "kr", sku: chosen.sku }, [chosen], now));
    return reply(chosen.name + " (" + chosen.sku + ")\n\n" + renderFacts(chosen, 8) +
      "\n\n※ 수집된 정보만 표시했으며, 누락된 스펙은 추정하지 않습니다. 전체 제품의 스펙 완전성은 아직 검증되지 않았습니다.",
      [chosen], events);
  }
  const items = dedupModel(candidates, 4);
  return reply("현재 수집된 삼성닷컴 한국 스마트폰 목록에서 " + results.matched +
    "개 SKU가 검색됐습니다. 아래는 확인 가능한 제품 후보입니다.\n\n" +
    items.map(p => "• " + p.name + " (" + p.sku + ")").join("\n") +
    "\n\n원하는 모델의 스펙·가격·비교를 질문해 보세요. 모든 SKU가 수집되었다는 의미는 아닙니다.",
    items, events);
}
