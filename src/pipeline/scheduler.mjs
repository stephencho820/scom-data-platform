export const DEFAULT_REFRESH_HOURS = Object.freeze({
  commerce: 24,
  knowledge: 168,
  product: 2160,
  other: 720
});

export function urlDataType(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (/\/buy\/|\/trade-in|\/subscription|\/financing|\/samsung-care|\/delivery|\/installation/.test(pathname)) return "commerce";
  if (/\/support\/|manual|download|warranty|repair|\/faq/.test(pathname)) return "knowledge";
  if (/\/product\/|\/smartphones\/|\/tablets\/|\/galaxy-watch\/|\/watches\/|\/buds\/|\/rings\/|\/tvs\/|\/monitors\/|\/refrigerators\//.test(pathname)) return "product";
  return "other";
}

export function selectDueUrls(urls, visitedUrls, existingPages, attempts = {}, {
  at = Date.now(), batchSize = 120, hours = DEFAULT_REFRESH_HOURS
} = {}) {
  const now = typeof at === "number" ? at : Date.parse(at);
  const latestPage = new Map();
  for (const row of existingPages) {
    for (const url of [row.url, row.discovered_url, row.canonical_url]) {
      if (url && (!latestPage.has(url) || Date.parse(row.captured_at) > Date.parse(latestPage.get(url).captured_at))) latestPage.set(url, row);
    }
  }
  const dueCommerce = [], unseen = [], otherDue = [];
  for (const url of urls) {
    const retryAfter = Date.parse(attempts[url]?.retry_after || "");
    if (Number.isFinite(retryAfter) && retryAfter > now) continue;
    const wasVisited = visitedUrls.has(url) || latestPage.has(url);
    if (!wasVisited) { unseen.push(url); continue; }
    const record = latestPage.get(url);
    const stamp = Date.parse(record?.captured_at || "");
    const kind = urlDataType(url);
    if (Number.isFinite(stamp) && now - stamp < (hours[kind] ?? hours.other) * 3600000) continue;
    (kind === "commerce" ? dueCommerce : otherDue).push(url);
  }
  const limit = Math.max(0, Math.min(batchSize, urls.length));
  const selected = [], seen = new Set();
  const add = (from, count) => {
    for (const url of from) {
      if (selected.length >= limit || count <= 0) break;
      if (seen.has(url)) continue;
      selected.push(url); seen.add(url); count--;
    }
  };
  // A permanently incomplete sitemap backlog must not starve today's offers.
  add(dueCommerce, Math.max(1, Math.floor(limit / 3)));
  add(unseen, limit - selected.length);
  add(dueCommerce, limit - selected.length);
  add(otherDue, limit - selected.length);
  return { selected, outstanding: { unseen: unseen.length, commerce_due: dueCommerce.length, other_due: otherDue.length } };
}

export function recordAttempt(attempts, url, succeeded, now = new Date().toISOString()) {
  if (succeeded) { delete attempts[url]; return attempts; }
  const prior = attempts[url]?.failure_count || 0;
  const failure_count = Math.min(prior + 1, 32);
  const retryHours = Math.min(168, Math.pow(2, Math.min(7, failure_count - 1)));
  attempts[url] = {
    failure_count,
    retry_after: new Date(Date.parse(now) + retryHours * 3600000).toISOString(),
    last_failed_at: now
  };
  return attempts;
}
