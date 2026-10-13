import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const pageFile = path.resolve(ROOT, process.argv[2] || "dist/status.html");
const MART = path.resolve(ROOT, "data/marts/kr");
const ko = {
  current_catalog_coverage: "카탈로그 내부 대조",
  no_failed_catalog_sources: "수집 소스 오류 없음",
  current_specs_complete: "현재 SKU 스펙 확보",
  support_linkage_complete: "지원 자료 SKU 연결",
  legacy_ingestion_present: "과거 제품 확보",
  unresolved_products_zero: "미분류 SKU 없음"
};
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const fmt = value => Number.isFinite(value) ? value.toLocaleString("ko-KR") : "—";
const row = (name, value, good = null) =>
  '<div class="status-row"><span>' + escape(name) + '</span><b class="' +
  (good === null ? "" : good ? "status-pass" : "status-fail") +
  '">' + escape(value) + "</b></div>";
const card = (name, value) =>
  '<div class="status-metric"><small>' + escape(name) + '</small><strong>' + escape(value) + "</strong></div>";
async function load(name) {
  try { return JSON.parse(await readFile(path.join(MART, name), "utf8")); }
  catch { return null; }
}
function replaceElement(html, id, inner, { attributes = null } = {}) {
  const r = new RegExp('(<([a-z]+)\\b[^>]*\\bid="' + id + '"[^>]*>)([\\s\\S]*?)(<\\/\\2>)', "i");
  if (!r.test(html)) throw new Error("Status template missing #" + id);
  return html.replace(r, (_, open, tag, old, end) => (attributes ? open.replace(/class="([^"]+)"/, 'class="$1 ' + attributes + '"') : open) + inner + end);
}
const readiness = await load("chatbot_readiness.json");
const coverage = await load("current_catalog_coverage.json");
const incremental = await load("incremental_report.json");
let html = await readFile(pageFile, "utf8");
const isReady = readiness?.ready === true && coverage?.complete === true;
if (readiness && coverage) {
  const counts = readiness.counts || {};
  const metricRows = [
    ["등록된 SKU", counts.sku_registry],
    ["현재 카탈로그 SKU", counts.current_skus],
    ["스펙 보유 SKU", counts.current_skus_with_specs],
    ["성공한 카탈로그 소스", fmt(coverage.catalog_sources_ok) + " / " + fmt(coverage.catalog_sources_total)],
    ["하만 SKU", (() => {
      const sources = (coverage.categories || []).filter(item => item.business_unit === "HARMAN");
      return sources.length && sources.every(item => item.source_status === "ok")
        ? sources.reduce((sum, item) => sum + (item.discovered_unique_skus || 0), 0) : "수집 전";
    })()]
  ];
  html = replaceElement(html, "status-pill", isReady ? "READY" : "NOT READY", {attributes: isReady ? "is-good" : null});
  const checked = new Date(readiness.generated_at);
  const when = Number.isNaN(checked.getTime()) ? "확인되지 않음" : checked.toLocaleString("ko-KR", {timeZone:"Asia/Seoul"});
  html = replaceElement(html, "status-updated", "마지막 수집 스냅샷: " + escape(when));
  html = replaceElement(html, "status-metrics", metricRows.map(([label,num]) => card(label, typeof num==="number" ? fmt(num) : num)).join(""));
  html = replaceElement(html, "status-gates", Object.entries(readiness.gates || {}).map(([key,value])=>row(ko[key] || key, value ? "통과" : "미완료", value)).join(""));
  html = replaceElement(html, "status-sync-time", incremental ? "마지막 증분 실행: " + escape(incremental.checked_at) : "증분 수집 결과가 아직 없습니다.");
  html = replaceElement(html, "status-sync", incremental?.stats ? [
    row("신규 SKU", fmt(incremental.stats.new_skus)),
    row("스펙 업데이트", fmt(incremental.stats.specs_enriched_or_corrected)),
    row("가격 변경", fmt(incremental.stats.offers_changed)),
    row("가격 확인", fmt(incremental.stats.offers_verified))
  ].join("") : "");
  html = replaceElement(html, "status-categories", (coverage.categories||[]).map(item=>
    "<tr>" + [
      (item.business_unit || "OTHER") + " / " + (item.category || ""),
      fmt(item.discovered_unique_skus),
      fmt(item.db_current_unique_skus),
      item.complete ? "통과" : "미완료"
    ].map(v=>"<td>"+escape(v)+"</td>").join("") +
    '<td><a target="_blank" rel="noopener noreferrer" href="' +
    (safeSource(item.source_url) || "#") + '">↗</a></td></tr>'
  ).join(""));
}
else {
  html = replaceElement(html, "status-pill", "DATA UNAVAILABLE");
  html = replaceElement(html, "status-updated", "배포 데이터 파일을 확인할 수 없습니다.");
}
function safeSource(candidate) {
  try { const url = new URL(candidate); return url.protocol === "https:" && url.hostname === "www.samsung.com" ? escape(url.href) : "#"; }
  catch { return "#"; }
}
// This is the actual published snapshot, not a fabricated sample.
// Hydration can replace it with fresher values, but the HTML remains readable
// even if JavaScript or API requests fail.
const payload = JSON.stringify({readiness, coverage, incremental}).replace(/</g, "\\u003c");
const embed = '<script type="application/json" id="status-bootstrap">' + payload + "</script>";
html = html.replace('<script src="./site.js"></script>', embed+'\n<script src="./site.js"></script>');
await writeFile(pageFile, html);
console.log(JSON.stringify({
  page: pageFile,
  ready: isReady,
  current_skus: readiness?.counts?.current_skus ?? null,
  catalog_sources: coverage?.catalog_sources_total ?? null,
  status_static: Boolean(readiness && coverage)
}));
