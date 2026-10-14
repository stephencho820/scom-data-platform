import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const routes=["index.html","status.html","catalog.html","registry.html","explorer.html","ai-data.html"];
const canonical=[["./","navOverview"],["./registry.html","navSpec"],["./ai-data.html","navAiData"],["./#connect","navConnect"]];
test("all public pages have one consistent four-link AI-ready portal navigation",async()=>{
 for(const route of routes){const html=await readFile("web/"+route,"utf8");const nav=html.match(/<nav\b[^>]*class="main-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0];assert.ok(nav,"Missing nav "+route);const links=[...nav.matchAll(/<a\b([^>]+)>/g)].map(m=>[m[1].match(/\bhref="([^"]+)"/)?.[1],m[1].match(/\bdata-i18n="([^"]+)"/)?.[1]]);assert.deepEqual(links,canonical,"Nav mismatch "+route);assert.match(html,/<script src="\.\/site\.js\?v=[^"]+"><\/script>/,"Versioned shared script missing "+route)}
});
test("shared site owns canonical AI-ready navigation and both language labels",async()=>{
 const js=await readFile("web/site.js","utf8");assert.ok(js.includes("const NAVIGATION_ITEMS = Object.freeze("));assert.ok(js.includes("function syncMainNavigation()"));assert.ok(js.includes("syncMainNavigation();"));for(const [href,key] of canonical){assert.ok(js.includes('href: "'+href+'"'),"Missing href "+href);assert.ok(js.includes('key: "'+key+'"'),"Missing key "+key)}assert.match(js,/navSpec:"AI-Ready 명세"/);assert.match(js,/navSpec:"AI-Ready Schema"/);
});
