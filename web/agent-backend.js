import { SHOPPING_AGENT_BACKEND_URL } from "./agent-config.js";

const CODE_KEY = "scom-shopping-agent-poc-code";

export function backendUrl() {
  const raw = String(SHOPPING_AGENT_BACKEND_URL || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" ||
        !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
        url.pathname !== "/functions/v1/shopping-agent" ||
        url.search || url.hash) return null;
    return url.href;
  } catch { return null; }
}
export async function askRemoteAgent(message, history = [], {
  askCode = () => window.prompt("Shopping Agent POC 접속 코드 (OpenAI API 키가 아닙니다)")
} = {}) {
  const url = backendUrl();
  if (!url) throw new Error("backend_not_configured");
  let code = sessionStorage.getItem(CODE_KEY);
  if (!code) {
    code = askCode();
    if (!code) throw new Error("access_code_required");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-poc-access-code": code
      },
      body: JSON.stringify({ message, history }),
      cache: "no-store",
      signal: controller.signal
    });
    let result = {};
    try { result = await res.json(); } catch { /* invalid backend response */ }
    if (!res.ok) {
      if (res.status === 401) sessionStorage.removeItem(CODE_KEY);
      throw new Error(String(result.error || "agent_http_" + res.status));
    }
    sessionStorage.setItem(CODE_KEY, code); // browser tab lifetime only
    return result;
  } finally { clearTimeout(timeout); }
}
export function clearAccessCode() {
  sessionStorage.removeItem(CODE_KEY);
}
