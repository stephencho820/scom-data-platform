import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import catalog from "../api/catalog.js";
import chat from "../api/chat.js";

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("catalog health returns explicit limitations without leaked credentials", async () => {
  const res = response();
  await catalog({ method: "GET", url: "/api/catalog?status=1" }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.market, "kr");
  assert.equal(res.body.supports_live_inventory, false);
  assert.equal(res.headers["Cache-Control"], "private, no-store, max-age=0");
});

test("chat endpoint rejects cross-origin and disallowed methods", async () => {
  const forbidden = response();
  await chat({ method: "POST", headers: { origin: "https://evil.example",
    host: "our-project.vercel.app" }, body: { message: "hi" } }, forbidden);
  assert.equal(forbidden.statusCode, 403);
  const wrongMethod = response();
  await chat({ method: "GET", headers: {} }, wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);
});

test("chat endpoint cannot serve AI without a server-side API key", async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const res = response();
    await chat({ method: "POST", headers: {}, body: { message: "갤럭시" } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, "agent_not_configured");
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("static website build includes responsive chat and developer monitor", async () => {
  execFileSync(process.execPath, ["scripts/build-shopping-agent-web.mjs"], { stdio: "pipe" });
  const html = await readFile("public/index.html", "utf8");
  const js = await readFile("public/agent.js", "utf8");
  assert.match(html, /id="messages"/);
  assert.match(html, /id="catalog-grid"/);
  assert.match(html, /id="inspector"/);
  assert.match(js, /\/api\/chat/);
  assert.match(js, /\/api\/catalog/);
  assert.ok((await stat("public/agent.css")).size > 1000);
});


test("local web server serves customer UI and real catalog endpoint", async () => {
  execFileSync(process.execPath, ["scripts/build-shopping-agent-web.mjs"], { stdio: "pipe" });
  const port = 39761;
  const child = spawn(process.execPath, ["scripts/serve-shopping-agent.mjs"], {
    env: { ...process.env, AGENT_PORT: String(port), OPENAI_API_KEY: "" },
    stdio: "ignore"
  });
  const origin = "http://127.0.0.1:" + port;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const res = await fetch(origin + "/api/catalog?status=1");
        if (res.ok) { ready = true; break; }
      } catch { /* starting */ }
      await new Promise(resolve => setTimeout(resolve, 70));
    }
    assert.ok(ready, "Local agent server should be reachable");
    const html = await (await fetch(origin)).text();
    assert.match(html, /Shopping AI Agent/);
    const catalogResult = await (await fetch(origin + "/api/catalog?q=갤럭시&category=smartphones")).json();
    assert.equal(catalogResult.status, "ok");
    assert.ok(Array.isArray(catalogResult.products));
    const chatResponse = await fetch(origin + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ message: "갤럭시 플립 스펙 알려줘" })
    });
    assert.equal(chatResponse.status, 503);
    assert.equal((await chatResponse.json()).error, "agent_not_configured");
  } finally {
    child.kill("SIGTERM");
  }
});
