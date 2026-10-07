const explorer = {
  registry: null,
  market: "us",
  dataset: "products",
  query: "",
  rows: [],
  meta: null,
  visible: 20,
  cache: new Map()
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseJsonl(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function formatCaptured(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatPrice(offers) {
  if (!offers?.price) return "";
  const numeric = Number(offers.price);
  if (!Number.isFinite(numeric)) return `${offers.price} ${offers.currency || ""}`.trim();
  try {
    return new Intl.NumberFormat(undefined, {
      style: offers.currency ? "currency" : "decimal",
      currency: offers.currency || undefined,
      maximumFractionDigits: 2
    }).format(numeric);
  } catch {
    return `${offers.price} ${offers.currency || ""}`.trim();
  }
}

function availabilityLabel(value = "") {
  const raw = String(value);
  if (!raw) return "";
  const clean = raw.split("/").pop();
  return clean.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function truncate(value = "", max = 210) {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

function formatNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat().format(numeric) : String(value || 0);
}

function coverageText(meta) {
  const total = Number(meta?.crawlable_urls_total || 0);
  if (!total) return "";
  const covered = Number(meta?.coverage_pages || meta?.pages_written || 0);
  const percent = Number(meta?.coverage_percent || ((covered / total) * 100));
  return formatNumber(covered) + " / " + formatNumber(total) + " pages · " + percent.toFixed(2) + "%";
}

function productIdentity(row) {
  return row.model || row.sku || row.name || row.key || "Product";
}

function groupHistoryRecords(rows) {
  const groups = new Map();

  for (const row of rows) {
    const key = row.key || `${row.market}:${productIdentity(row)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return [...groups.entries()].map(([key, versions]) => {
    versions.sort((a, b) => new Date(a.captured_at || 0) - new Date(b.captured_at || 0));
    return {
      key,
      market: versions[versions.length - 1]?.market || "",
      latest: versions[versions.length - 1],
      first: versions[0],
      versions
    };
  }).sort((a, b) => {
    const aTime = new Date(a.latest?.captured_at || 0).getTime();
    const bTime = new Date(b.latest?.captured_at || 0).getTime();
    return bTime - aTime;
  });
}

function historyChangeList(current, previous) {
  if (!previous) return [{ label: "Initial capture", initial: true }];

  const fields = [
    ["Name", current.name || "", previous.name || ""],
    ["Model", current.model || "", previous.model || ""],
    ["SKU", current.sku || "", previous.sku || ""],
    ["Price", formatPrice(current.offers), formatPrice(previous.offers)],
    ["Availability", availabilityLabel(current.offers?.availability), availabilityLabel(previous.offers?.availability)],
    ["Source", current.url || "", previous.url || ""]
  ];

  return fields
    .filter(([, now, before]) => String(now) !== String(before))
    .map(([label, now, before]) => ({
      label: before && now ? `${label}: ${before} → ${now}` : `${label}: ${now || "removed"}`,
      initial: false
    }));
}

function historySearchText(group) {
  return group.versions.map((row) => [
    row.name,
    row.model,
    row.sku,
    row.brand,
    row.url,
    row.offers?.price,
    row.offers?.currency,
    row.offers?.availability
  ].filter(Boolean).join(" ")).join(" ").toLowerCase();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function loadMarkets() {
  const target = $("#market-list");
  try {
    const registry = await fetchJson("./config/markets.json");
    explorer.registry = registry;

    const marketSelect = $("#explorer-market");
    marketSelect.innerHTML = registry.markets
      .map((market) => `<option value="${escapeHtml(market.code)}">${escapeHtml(market.country)} · ${escapeHtml(market.code.toUpperCase())}</option>`)
      .join("");

    if (!registry.markets.some((market) => market.code === explorer.market)) {
      explorer.market = registry.markets[0]?.code || "";
    }
    marketSelect.value = explorer.market;

    const rows = await Promise.all(registry.markets.map(async (market) => {
      try {
        const meta = await fetchJson(`./data/current/${market.code}/meta.json`);
        return { market, meta };
      } catch {
        return { market, meta: null };
      }
    }));

    target.innerHTML = rows.map(({ market, meta }) => `
      <div class="market" data-market="${escapeHtml(market.code)}" role="button" tabindex="0">
        <strong>${escapeHtml(market.code)}</strong>
        <div>
          <div>${escapeHtml(market.country)}</div>
          <small>${meta ? `${coverageText(meta) || (formatNumber(meta.pages_written) + " pages")} · ${formatNumber(meta.products_written)} products` : "Configured · awaiting first crawl"}</small>
        </div>
        <span class="badge">${meta ? "current" : "seed"}</span>
      </div>
    `).join("");

    $$(".market[data-market]").forEach((row) => {
      const activate = () => {
        explorer.market = row.dataset.market;
        marketSelect.value = explorer.market;
        explorer.visible = 20;
        loadExplorer();
        $("#explorer").scrollIntoView({ behavior: "smooth", block: "start" });
      };
      row.addEventListener("click", activate);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") activate();
      });
    });
  } catch (error) {
    target.innerHTML = `<p>Dataset status is not available yet: ${escapeHtml(error.message)}</p>`;
    $("#explorer-summary").textContent = "Market registry unavailable.";
  }
}

async function loadExplorer() {
  if (!explorer.market) return;

  const results = $("#explorer-results");
  const summary = $("#explorer-summary");
  const captured = $("#explorer-captured");
  const more = $("#explorer-more");

  results.innerHTML = '<div class="loading-state">Loading current snapshot…</div>';
  summary.textContent = "Loading dataset…";
  captured.textContent = "";
  more.hidden = true;

  const key = `${explorer.market}:${explorer.dataset}`;

  try {
    if (!explorer.cache.has(key)) {
      const dataUrl = explorer.dataset === "history"
        ? `./data/history/products/${explorer.market}.jsonl`
        : `./data/current/${explorer.market}/${explorer.dataset}.jsonl`;

      const [dataResponse, meta] = await Promise.all([
        fetch(dataUrl),
        fetchJson(`./data/current/${explorer.market}/meta.json`)
      ]);
      if (!dataResponse.ok) throw new Error(`${dataResponse.status} ${dataResponse.statusText}`);
      const parsedRows = parseJsonl(await dataResponse.text());
      const rows = explorer.dataset === "history" ? groupHistoryRecords(parsedRows) : parsedRows;
      explorer.cache.set(key, { rows, meta, versionCount: parsedRows.length });
    }

    const cached = explorer.cache.get(key);
    explorer.rows = cached.rows;
    explorer.meta = cached.meta;
    explorer.versionCount = cached.versionCount || null;
    renderExplorer();
  } catch (error) {
    explorer.rows = [];
    explorer.meta = null;
    results.innerHTML = `<div class="empty-state">Could not load this dataset: ${escapeHtml(error.message)}</div>`;
    summary.textContent = "Dataset unavailable.";
  }
}

function filteredRows() {
  const q = explorer.query.trim().toLowerCase();
  if (!q) return explorer.rows;

  return explorer.rows.filter((row) => {
    if (explorer.dataset === "products") {
      return [
        row.name,
        row.sku,
        row.model,
        row.brand,
        row.url,
        row.offers?.price,
        row.offers?.currency,
        row.offers?.availability
      ].some((value) => String(value || "").toLowerCase().includes(q));
    }

    if (explorer.dataset === "history") {
      return historySearchText(row).includes(q);
    }

    return [
      row.title,
      row.description,
      row.text,
      row.url,
      row.canonical_url
    ].some((value) => String(value || "").toLowerCase().includes(q));
  });
}

function renderExplorer() {
  const results = $("#explorer-results");
  const summary = $("#explorer-summary");
  const captured = $("#explorer-captured");
  const more = $("#explorer-more");
  const rows = filteredRows();
  const shown = rows.slice(0, explorer.visible);

  if (explorer.dataset === "history") {
    const versions = explorer.versionCount || explorer.rows.reduce((sum, group) => sum + group.versions.length, 0);
    summary.textContent = explorer.query
      ? `${rows.length} matching tracked products · ${explorer.rows.length} total`
      : `${explorer.rows.length} tracked products · ${versions} saved versions`;
    captured.textContent = explorer.meta?.captured_at
      ? `Latest crawl ${formatCaptured(explorer.meta.captured_at)}${coverageText(explorer.meta) ? " · " + coverageText(explorer.meta) : ""}`
      : "";
  } else {
    const noun = explorer.dataset === "products" ? "products" : "pages";
    summary.textContent = explorer.query
      ? `${rows.length} matching ${noun} · ${explorer.rows.length} total`
      : `${explorer.rows.length} ${noun} in current snapshot`;
    captured.textContent = explorer.meta?.captured_at
      ? `Captured ${formatCaptured(explorer.meta.captured_at)}${coverageText(explorer.meta) ? " · " + coverageText(explorer.meta) : ""}`
      : "";
  }

  if (!rows.length) {
    results.innerHTML = '<div class="empty-state">No matching records. Try another keyword.</div>';
    more.hidden = true;
    return;
  }

  results.innerHTML = shown.map((row, index) => {
    if (explorer.dataset === "history") {
      const latest = row.latest || {};
      const first = row.first || latest;
      const price = formatPrice(latest.offers);
      const latestChanges = row.versions.length > 1
        ? historyChangeList(latest, row.versions[row.versions.length - 2]).length
        : 0;
      const range = row.versions.length > 1
        ? `${formatCaptured(first.captured_at)} → ${formatCaptured(latest.captured_at)}`
        : `First captured ${formatCaptured(latest.captured_at)}`;

      return `
        <button class="result-row" type="button" data-result-index="${index}">
          <div class="result-main">
            <div class="result-kicker">History · ${escapeHtml(latest.market?.toUpperCase() || explorer.market.toUpperCase())}</div>
            <h3 class="result-title">${escapeHtml(latest.name || latest.model || latest.sku || "Unnamed product")}</h3>
            <p class="result-description">${escapeHtml(range)}</p>
          </div>
          <div class="result-side">
            ${price ? `<span class="result-price">${escapeHtml(price)}</span>` : ""}
            <span class="history-version-count">${row.versions.length} version${row.versions.length === 1 ? "" : "s"}</span>
            <span class="result-meta">${row.versions.length > 1 ? `${latestChanges} latest change${latestChanges === 1 ? "" : "s"}` : "Waiting for next change"}</span>
            <span class="result-arrow">↗</span>
          </div>
        </button>
      `;
    }

    if (explorer.dataset === "products") {
      const price = formatPrice(row.offers);
      const availability = availabilityLabel(row.offers?.availability);
      const identity = [row.model, row.sku].filter(Boolean).join(" · ");
      return `
        <button class="result-row" type="button" data-result-index="${index}">
          <div class="result-main">
            <div class="result-kicker">Product · ${escapeHtml(row.market?.toUpperCase() || explorer.market.toUpperCase())}</div>
            <h3 class="result-title">${escapeHtml(row.name || row.model || row.sku || "Unnamed product")}</h3>
            <p class="result-description">${escapeHtml(identity || truncate(row.url, 140))}</p>
          </div>
          <div class="result-side">
            ${price ? `<span class="result-price">${escapeHtml(price)}</span>` : ""}
            ${availability ? `<span class="result-meta">${escapeHtml(availability)}</span>` : ""}
            <span class="result-arrow">↗</span>
          </div>
        </button>
      `;
    }

    return `
      <button class="result-row" type="button" data-result-index="${index}">
        <div class="result-main">
          <div class="result-kicker">Page · ${escapeHtml(row.market?.toUpperCase() || explorer.market.toUpperCase())}</div>
          <h3 class="result-title">${escapeHtml(row.title || row.url || "Untitled page")}</h3>
          <p class="result-description">${escapeHtml(row.description || truncate(row.text, 240))}</p>
        </div>
        <div class="result-side">
          <span class="result-meta">${escapeHtml(new URL(row.canonical_url || row.url).pathname)}</span>
          <span class="result-arrow">↗</span>
        </div>
      </button>
    `;
  }).join("");

  $$(".result-row").forEach((button) => {
    button.addEventListener("click", () => {
      const row = shown[Number(button.dataset.resultIndex)];
      openDetail(row);
    });
  });

  more.hidden = rows.length <= explorer.visible;
}

function detailRow(label, value) {
  if (value === undefined || value === null || value === "") return "";
  return `
    <div class="detail-label">${escapeHtml(label)}</div>
    <div class="detail-value">${escapeHtml(String(value))}</div>
  `;
}

function openDetail(row) {
  const dialog = $("#data-dialog");
  const isProduct = explorer.dataset === "products";
  const isHistory = explorer.dataset === "history";

  if (isHistory) {
    openHistoryDetail(row);
    return;
  }

  $("#dialog-type").textContent = isProduct ? "PRODUCT RECORD" : "PAGE RECORD";
  $("#dialog-title").textContent = isProduct
    ? (row.name || row.model || row.sku || "Product")
    : (row.title || "Page");
  $("#dialog-source").href = row.canonical_url || row.url || "#";

  if (isProduct) {
    $("#dialog-body").innerHTML = `
      <div class="detail-grid">
        ${detailRow("Market", row.market)}
        ${detailRow("Model", row.model)}
        ${detailRow("SKU", row.sku)}
        ${detailRow("Brand", row.brand)}
        ${detailRow("Price", formatPrice(row.offers))}
        ${detailRow("Availability", availabilityLabel(row.offers?.availability))}
        ${detailRow("Captured", formatCaptured(row.captured_at))}
        ${detailRow("Product key", row.key)}
        ${detailRow("Fingerprint", row.fingerprint)}
        ${detailRow("Source URL", row.url)}
      </div>
    `;
  } else {
    $("#dialog-body").innerHTML = `
      <div class="detail-grid">
        ${detailRow("Market", row.market)}
        ${detailRow("Description", row.description)}
        ${detailRow("Captured", formatCaptured(row.captured_at))}
        ${detailRow("Page ID", row.id)}
        ${detailRow("Content hash", row.content_hash)}
        ${detailRow("Canonical URL", row.canonical_url)}
        ${detailRow("Source URL", row.url)}
      </div>
      <div class="detail-text">${escapeHtml(row.text || "")}</div>
    `;
  }

  dialog.showModal();
}

function openHistoryDetail(group) {
  const dialog = $("#data-dialog");
  const versions = [...group.versions].sort((a, b) => new Date(b.captured_at || 0) - new Date(a.captured_at || 0));
  const latest = versions[0] || {};
  const oldest = versions[versions.length - 1] || latest;

  $("#dialog-type").textContent = "PRODUCT HISTORY";
  $("#dialog-title").textContent = latest.name || latest.model || latest.sku || "Product history";
  $("#dialog-source").href = latest.url || "#";

  const changedVersions = versions.filter((version, index) => {
    if (index === versions.length - 1) return false;
    return historyChangeList(version, versions[index + 1]).length > 0;
  }).length;

  const timeline = versions.map((version, index) => {
    const previous = index === versions.length - 1 ? null : versions[index + 1];
    const changes = historyChangeList(version, previous);
    const price = formatPrice(version.offers);
    const availability = availabilityLabel(version.offers?.availability);

    return `
      <div class="history-entry">
        <div class="history-date">${escapeHtml(formatCaptured(version.captured_at))}</div>
        <div class="history-content">
          <div class="history-headline">
            ${price ? `<span class="history-price">${escapeHtml(price)}</span>` : ""}
            ${availability ? `<span class="history-status">${escapeHtml(availability)}</span>` : ""}
          </div>
          <div class="change-list">
            ${changes.length
              ? changes.map((change) => `<span class="change-chip${change.initial ? " initial" : ""}">${escapeHtml(change.label)}</span>`).join("")
              : '<span class="change-chip">Fingerprint changed</span>'}
          </div>
        </div>
      </div>
    `;
  }).join("");

  $("#dialog-body").innerHTML = `
    <div class="history-summary-grid">
      <div class="history-stat">
        <strong>${versions.length}</strong>
        <span>Saved versions</span>
      </div>
      <div class="history-stat">
        <strong>${changedVersions}</strong>
        <span>Change events</span>
      </div>
      <div class="history-stat">
        <strong>${escapeHtml(formatPrice(latest.offers) || "—")}</strong>
        <span>Latest price</span>
      </div>
    </div>

    <div class="detail-grid">
      ${detailRow("Market", latest.market)}
      ${detailRow("Model", latest.model)}
      ${detailRow("SKU", latest.sku)}
      ${detailRow("First captured", formatCaptured(oldest.captured_at))}
      ${detailRow("Latest captured", formatCaptured(latest.captured_at))}
      ${detailRow("Product key", group.key)}
    </div>

    ${versions.length === 1
      ? '<div class="history-note">Only the initial version exists right now. A new version will be added automatically when a future crawl detects a changed product fingerprint, such as a price, availability, name, model, SKU, or other normalized product field.</div>'
      : ""}

    <div class="history-timeline">${timeline}</div>
  `;

  dialog.showModal();
}

function closeDetail() {
  const dialog = $("#data-dialog");
  if (dialog.open) dialog.close();
}

function setupExplorerEvents() {
  $("#explorer-market").addEventListener("change", (event) => {
    explorer.market = event.target.value;
    explorer.visible = 20;
    loadExplorer();
  });

  $$(".dataset-tab").forEach((button) => {
    button.addEventListener("click", () => {
      explorer.dataset = button.dataset.dataset;
      explorer.visible = 20;
      $$(".dataset-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      $("#explorer-search").placeholder = explorer.dataset === "products"
        ? "Search products…"
        : explorer.dataset === "pages"
          ? "Search page titles or text…"
          : "Search product history…";
      loadExplorer();
    });
  });

  $("#explorer-search").addEventListener("input", (event) => {
    explorer.query = event.target.value;
    explorer.visible = 20;
    renderExplorer();
  });

  $("#explorer-more").addEventListener("click", () => {
    explorer.visible += 20;
    renderExplorer();
  });

  $("#dialog-close").addEventListener("click", closeDetail);
  $("#dialog-close-bottom").addEventListener("click", closeDetail);
  $("#data-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeDetail();
  });
}

async function init() {
  setupExplorerEvents();
  await loadMarkets();
  await loadExplorer();
}

init();
