const $ = id => document.getElementById(id);
const state = { sending: false, aiReady: false, history: [], found: [] };
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
function setService(ready, online = true) {
  state.aiReady = Boolean(ready);
  const node = $("service-state");
  node.classList.toggle("warn", online && !ready);
  node.classList.toggle("fail", !online);
  node.lastChild.textContent = !online ? "데이터 연결 오류" : ready ? "AI 연결됨" : "제품 탐색만 가능";
  $("composer-hint").textContent = ready ?
    "Enter로 전송 · Shift+Enter 줄바꿈 · 수집 데이터 출처를 검증한 뒤 답변합니다." :
    "현재 제품 탐색만 가능합니다. AI 채팅은 서버에 OPENAI_API_KEY를 설정하면 활성화됩니다.";
}
async function loadStatus() {
  try {
    const response = await fetch("/api/catalog?status=1", { cache: "no-store" });
    if (!response.ok) throw new Error("offline");
    const result = await response.json();
    setService(result.ai_configured, true);
  } catch { setService(false, false); }
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
  if (state.aiReady && p.sku) {
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
  grid.replaceChildren(el("div", "catalog-loading", "제품 SKU를 조회하고 있어요…"));
  $("search-catalog").disabled = true;
  try {
    const url = "/api/catalog?" + new URLSearchParams({ q: query || "갤럭시",
      category: "smartphones", limit: "12" }).toString();
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("catalog error");
    const result = await response.json();
    if (result.status !== "ok") throw new Error("catalog not available");
    state.found = result.products || [];
    renderCards(grid, state.found);
    $("product-count").textContent = result.matched +
      " SKUs 확인" + (result.matched > state.found.length ? " · 일부 표시" : "");
  } catch {
    grid.replaceChildren(el("div", "catalog-empty",
      "현재 카탈로그를 불러올 수 없습니다. 백엔드 연결 상태를 확인해 주세요."));
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
  const placeholder = renderMessage("assistant", "제품 데이터를 조회하고 답변을 작성하고 있어요…");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, history: state.history.slice(-8) })
    });
    const result = await response.json();
    placeholder.remove();
    if (!response.ok) {
      if (result.error === "agent_not_configured") {
        showChatError("현재 제품 카탈로그 탐색 기능만 활성화되어 있습니다. AI 대화는 서버에서 API 키를 연결한 후 사용할 수 있어요. 아래에서 제품을 검색하거나 공식 제품 페이지를 열어 보세요.");
        $("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        showChatError(result.message || "질문을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      return;
    }
    renderMessage("assistant", result.answer || "확인 가능한 정보가 없습니다.", result.products || []);
    renderRun(result.developer);
    state.history.push({ role: "user", content: question },
      { role: "assistant", content: String(result.answer || "") });
    state.history = state.history.slice(-8);
  } catch {
    placeholder.remove();
    showChatError("Agent 서버에 연결하지 못했습니다. 서비스 상태를 확인해 주세요.");
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
loadStatus();
searchCatalog();
