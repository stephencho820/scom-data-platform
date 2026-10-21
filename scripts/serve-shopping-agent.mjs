/**
 * Local browser POC runner, no Vercel deployment required.
 * Serves static build and the exact same API handlers used in Vercel.
 * Binds only to localhost; never exposes the API key to browsers.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "../api/catalog.js";
import chat from "../api/chat.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/agent.css", ["agent.css", "text/css; charset=utf-8"]],
  ["/agent.js", ["agent.js", "text/javascript; charset=utf-8"]],
  ["/robots.txt", ["robots.txt", "text/plain; charset=utf-8"]]
]);
const port = Number(process.env.AGENT_PORT || 3001);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error("AGENT_PORT must be a valid TCP port");
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:" + port);
  const selected = url.pathname === "/api/chat" ? chat :
    url.pathname === "/api/catalog" ? catalog : null;
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (selected) {
    res.status = function(code) { this.statusCode = code; return this; };
    res.json = function(data) { this.end(JSON.stringify(data)); return this; };
    if (req.method === "POST") {
      let body = "";
      try {
        for await (const chunk of req) {
          body += chunk.toString("utf8");
          if (body.length > 20000) {
            res.statusCode = 413; res.end('{"error":"request_too_large"}'); return;
          }
        }
        req.body = JSON.parse(body || "{}");
      } catch {
        res.statusCode = 400; res.end('{"error":"bad_json"}'); return;
      }
    }
    try { await selected(req, res); }
    catch (error) {
      console.error("Agent server route failed:", error.message);
      if (!res.headersSent) res.statusCode = 500;
      res.end('{"error":"internal_server_error"}');
    }
    return;
  }
  const staticRoute = staticFiles.get(url.pathname);
  if (!staticRoute || req.method !== "GET") {
    res.statusCode = 404; res.end("Not found"); return;
  }
  try {
    const data = await readFile(path.join(root, "public", staticRoute[0]));
    res.setHeader("Content-Type", staticRoute[1]);
    res.end(data);
  } catch {
    res.statusCode = 500;
    res.end("Run: npm run build:shopping-agent");
  }
});
server.listen(port, "127.0.0.1", () => {
  console.log("Shopping Agent POC: http://127.0.0.1:" + port);
  if (!process.env.OPENAI_API_KEY) console.log("OPENAI_API_KEY not set: catalog only, AI chat disabled.");
});
