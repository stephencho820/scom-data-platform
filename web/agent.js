import { runDemoQuestion, searchCatalog as findProducts } from "./agent-demo.js";
import { backendUrl, askRemoteAgent } from "./agent-backend.js";
const $ = id => document.getElementById(id);
const state = { sending: false, snapshot: null, history: [], found: [] };
const usesRemote = Boolean(backendUrl());
const validProductUrl = url => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "www.samsung.com"
      ? parsed.href : null;
  } catch { return null; }
};
const el = (tag, cls, value) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (value !== undefined) node.textContent = String(value);
  return node;
};
const money = (amount, currency) => {
  try { return new Intl.NumberFormat("ko-KR", {
    style: "currency", currency: currency || "KRW", maximumFractionDigits: 0
  }).format(amount); }
  catch { return String(amount) + " " + (currency || ""); }
};
async function loadSnapshot() {
  const service = $("service-state");
  const hint = $("composer-hint");
  try {
    const response = await fetch("./data/demo/kr.json", { cache: "no-store" });
    if (!response.ok) throw new Error("snapshot unavailable");
    const snapshot = await response.json();
    if (snapshot.market !== "kr" || !Array.isArray(snapshot.products)) throw new Error("invalid snapshot");
    state.snapshot = snapshot;
    service.classList.remove("fail");
    service.classList.add("warn");
    service.lastChild.textContent = usesRemote ? "GPT 연결 설정됨 · POC 인증" : "브라우저 체험 · LLM 미연결";
    const produced = snapshot.generated_at ?
      new Date(snapshot.generated_at).toLocaleString("ko-KR") : "알 수 없음";
    hint.textContent = usesRemote ?
      "GPT Tool Calling 백엔드가 설정되었습니다. 첫 질문에서 POC 접속 코드로 인증합니다." :
      "Enter 전송 · Shift+Enter 줄바꿈 · 한국 SKU 스냅샷 (" +
      produced + ") · 규칙 기반 데모, 실제 LLM Agent 아님";
  } catch {
    state.snapshot = null;
    service.classList.add("fail");
    service.lastChild.textContent = "카탈로그 로드 실패";
    hint.textContent = "데이터 파일을 읽지 못했습니다. GitHub Pages 배포 및 파일 경로를 확인해 주세요.";
  }
}
function buildCard(p) {
  const source = validProductUrl(p.product_url);
  if (!source) return null;
  const card = el("article", "product-card");
  const visual = el("div", "product-visual");
  visual.setAttribute("aria-hidden", "true");
  visual.append(el("div", "device-art"));
  const info = el("div", "product-info");
  const tag = el("div", "product-tag", p.category === "smartphones" ? "GALAXY · SMARTPHONE" : "SAMSUNG PRODUCT");
  const name = el("h3", "", p.name || p.model || p.sku || "제품 정보");
  const sku = el("div", "product-sku", p.sku || "");
  const price = p.price || {};
  const priceVisible = price.status === "verified_recently" && Number(price.amount) > 0 &&
    !!price.currency;
  const priceText = priceVisible ?
    money(price.amount, price.currency) : "가격 최신 검증 필요";
  const priceNode = el("div", "product-price" + (priceVisible ? "" : " unknown"), priceText);
  const links = el("div", "product-actions");
  const official = el("a", "", "공식 제품 페이지 ↗");
  official.href = source;
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  links.append(official);
  if (state.snapshot && p.sku) {
    const ask = el("button", "", "스펙 질문 ↗");
    ask.type = "button";
    ask.addEventListener("click", () => sendMessage(p.sku + " 제품의 주요 사양을 알려줘."));
    links.append(ask);
  }
  const note = el("div", "product-note",
    priceVisible ? "최근 확인된 사이트 표시가격 · 공식 공시가로 확정되지 않음" :
    "가격은 삼성닷컴에서 직접 확인하세요.");
  info.append(tag, name, sku, priceNode, links, note);
  card.append(visual, info);
  return card;
}
function renderCards(target, products) {
  target.replaceChildren();
  const cards = (products || []).map(buildCard).filter(Boolean);
  if (!cards.length) {
    target.append(el("div", "catalog-empty", "조건에 맞는 확인 가능한 SKU가 없습니다. 검색어를 바꾸거나 삼성닷컴에서 확인해 주세요."));
  } else target.append(...cards);
}
async function searchCatalog() {
  const query = $("catalog-query").value.trim().slice(0, 100);
  const grid = $("catalog-grid");
  grid.replaceChildren(el("div", "catalog-loading", "공개된 SKU 스냅샷을 검색하고 있어요…"));
  $("search-catalog").disabled = true;
  try {
    if (!state.snapshot) throw new Error("missing snapshot");
    const result = findProducts(state.snapshot.products, query || "갤럭시", {
      now: Date.now(), limit: 12
    });
    state.found = result.products;
    renderCards(grid, state.found);
    $("product-count").textContent = result.matched +
      " SKUs 확인" + (result.matched > state.found.length ? " · 일부 표시" : "");
  } catch {
    grid.replaceChildren(el("div", "catalog-empty",
      "스냅샷을 아직 불러오지 못했습니다. GitHub Pages 연결 상태를 확인해 주세요."));
    $("product-count").textContent = "조회 실패";
  } finally { $("search-catalog").disabled = false; }
}
function renderMessage(role, content, products = []) {
  const row = el("article", "message " + role);
  const body = el("div", "message-body");
  if (role === "assistant") row.append(el("div", "message-avatar", "✳"));
  const bubble = el("div", "message-bubble", content);
  body.append(bubble);
  if (products.length) {
    const cards = el("div", "inline-cards");
    const productNodes = products.map(buildCard).filter(Boolean).slice(0, 4);
    cards.append(...productNodes);
    if (productNodes.length) body.append(cards);
  }
  if (role === "assistant") body.append(el("div", "message-meta",
    "수집된 정보 기준 · 최신 가격은 공식 사이트 재확인"));
  row.append(body);
  $("messages").append(row);
  row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return row;
}
function renderRun(info) {
  const rows = Array.isArray(info?.tools) ? info.tools : [];
  $("tool-count").textContent = rows.length + " tools";
  const log = $("tool-log");
  log.replaceChildren();
  if (!rows.length) {
    log.append(el("div", "empty-log", "도구 호출 기록이 없습니다."));
    return;
  }
  for (const entry of rows) {
    const item = el("div", "tool-item");
    const heading = el("div", "tool-name");
    heading.append(el("span", "", entry.name || "tool"));
    heading.append(el("span", "", entry.result_status || "executed"));
    const params = el("pre", "", JSON.stringify(entry.parameters || {}, null, 2));
    item.append(heading, params);
    const source = validProductUrl(entry.source_url);
    if (source) {
      const urlNode = el("a", "tool-source", "Samsung.com source ↗");
      urlNode.href = source; urlNode.target = "_blank"; urlNode.rel = "noopener noreferrer";
      item.append(urlNode);
    }
    if (entry.price_verified_at) {
      const verified = new Date(entry.price_verified_at);
      if (!Number.isNaN(verified.getTime())) item.append(
        el("div", "tool-freshness", "가격 검증: " + verified.toLocaleString("ko-KR"))
      );
    }
    log.append(item);
  }
}
function busy(mode) {
  state.sending = mode;
  $("message-input").disabled = mode;
  $("send-button").disabled = mode;
}
function showChatError(message) {
  renderMessage("assistant", message);
}
async function sendMessage(customQuestion = null) {
  if (state.sending) return;
  const input = $("message-input");
  const question = String(customQuestion ?? input.value).trim();
  if (!question) return;
  if (question.length > 1000) return showChatError("질문은 최대 1,000자까지 입력할 수 있어요.");
  $("welcome").hidden = true;
  renderMessage("user", question);
  input.value = "";
  input.style.height = "auto";
  busy(true);
  const placeholder = renderMessage("assistant", "수집된 SKU 데이터에서 근거를 찾고 있어요…");
  try {
    if (!usesRemote && !state.snapshot) throw new Error("snapshot unavailable");
    const result = usesRemote ?
      await askRemoteAgent(question, state.history.slice(-6)) :
      runDemoQuestion(question, state.snapshot, Date.now());
    placeholder.remove();
    renderMessage("assistant", result.answer, result.products || []);
    renderRun(result.developer);
    state.history.push({ role: "user", content: question },
      { role: "assistant", content: result.answer });
    state.history = state.history.slice(-8);
  } catch (error) {
    placeholder.remove();
    const reasons = {
      access_code_required: "접속 코드 입력이 취소되어 요청하지 않았습니다.",
      unauthorized: "POC 접속 코드가 올바르지 않습니다. 다음 질문에서 다시 입력해 주세요.",
      backend_not_configured: "GPT 백엔드가 아직 설정되지 않았습니다. 제품 검색은 계속 사용할 수 있어요.",
      rate_limited: "사용량 제한에 도달했습니다. 제품 검색 기능을 이용해 주세요.",
      agent_unavailable: "AI 응답을 가져올 수 없습니다. 수집된 제품 데이터는 아래에서 탐색할 수 있어요."
    };
    showChatError(reasons[error.message] ||
      "AI 또는 데이터 연결에 문제가 발생했습니다. 제품 검색을 이용해 주세요.");
  } finally {
    busy(false);
    input.focus();
  }
}
function setInspector(visible) {
  if (matchMedia("(max-width:1120px)").matches) {
    $("inspector").classList.toggle("open", visible);
  } else {
    document.body.classList.toggle("inspector-hidden", !visible);
  }
}
document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt));
});
$("send-button").addEventListener("click", () => sendMessage());
$("message-input").addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault(); sendMessage();
  }
});
$("message-input").addEventListener("input", event => {
  const node = event.currentTarget;
  node.style.height = "auto";
  node.style.height = Math.min(node.scrollHeight, 125) + "px";
});
$("search-catalog").addEventListener("click", searchCatalog);
$("catalog-query").addEventListener("keydown", event => {
  if (event.key === "Enter") searchCatalog();
});
$("show-catalog").addEventListener("click", () =>
  $("catalog").scrollIntoView({ behavior: "smooth", block: "start" }));
$("toggle-inspector").addEventListener("click", () => setInspector(true));
$("toggle-inspector-top").addEventListener("click", () =>
  setInspector(matchMedia("(max-width:1120px)").matches ?
    !$("inspector").classList.contains("open") :
    document.body.classList.contains("inspector-hidden")));
$("close-inspector").addEventListener("click", () => setInspector(false));
$("reset-chat").addEventListener("click", () => {
  state.history = []; $("messages").replaceChildren();
  $("welcome").hidden = false; renderRun(null);
  $("content-scroll").scrollTo({ top: 0, behavior: "smooth" });
});
loadSnapshot().then(searchCatalog);
