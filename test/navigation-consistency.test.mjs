import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const routes=["index.html","status.html","catalog.html","registry.html","explorer.html"];
const canonical=[
 ["./status.html","navStatus"],
 ["./catalog.html","navCatalog"],
 ["./registry.html","navRegistry"],
 ["./explorer.html","navExplorer"],
 ["./#demo","navDemo"],
 ["./#connect","navConnect"]
];

test("every published page uses the identical permanent navigation; none may independently add or reorder links",async()=>{
 for(const path of routes){
  const html=await readFile("web/"+path,"utf8");
  const nav=html.match(/<nav\b[^>]*class="main-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav,"Missing global nav in "+path);
  const links=[...nav.matchAll(/<a\b([^>]+)>/g)].map(m=>{
    const href=m[1].match(/\bhref="([^"]+)"/)?.[1];
    const key=m[1].match(/\bdata-i18n="([^"]+)"/)?.[1];
    return [href,key];
  });
  assert.deepEqual(links,canonical,"Navigation drift on "+path);
  assert.ok(html.includes('./site.js'),"Navigation runtime must load on "+path);
 }
});
test("shared site.js owns permanent nav, translations and active state",async()=>{
 const js=await readFile("web/site.js","utf8");
 assert.ok(js.includes("const NAVIGATION_ITEMS = Object.freeze("));
 assert.ok(js.includes("function syncMainNavigation()"));
 assert.ok(js.includes("syncMainNavigation();"));
 assert.ok(js.includes('window.addEventListener("hashchange",syncMainNavigation)'));
 for(const [href,key] of canonical){
  assert.ok(js.includes('href: "'+href+'"'),"Missing canonical href "+href);
  assert.ok(js.includes('key: "'+key+'"'),"Missing canonical key "+key);
 }
 assert.match(js,/navRegistry:"AI 마트 설계"/);
 assert.match(js,/navRegistry:"AI mart design"/);
});
