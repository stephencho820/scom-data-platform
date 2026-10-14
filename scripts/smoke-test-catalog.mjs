/**
 * Real Chromium smoke test for the published data mart catalog.
 * Asserts a table list is rendered (not just that the JavaScript parses).
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const root=path.resolve(process.argv[2]||"dist");
const chrome=process.env.CHROME_PATH || [
  "/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"
].find(Boolean);
if(!chrome)throw new Error("Chrome executable must be installed in the CI environment");

const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||"/","http://127.0.0.1");
  const pathname=decodeURIComponent(url.pathname);
  const file=path.resolve(root,"."+pathname);
  if(!file.startsWith(root+path.sep))throw Error("Path traversal");
  const data=await readFile(file);
  res.writeHead(200,{"content-type":mime[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});
  res.end(data);
 }catch{res.writeHead(404);res.end("Not found");}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const port=server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:chrome,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage();
 const errors=[];
 page.on("pageerror",error=>errors.push(String(error)));
 const endpoint="http://127.0.0.1:"+port+"/catalog.html";
 await page.goto(endpoint,{waitUntil:"domcontentloaded"});
 await page.locator(".catalog-table-item").first().waitFor({timeout:12000});
 let cards=await page.locator(".catalog-table-item").count();
 assert.equal(cards,12,"Expected 12 real data marts in browser, got "+cards);
 assert.equal((await page.locator("#catalog-stat-tables").innerText()).trim(),"12");
 assert.ok(Number((await page.locator("#catalog-stat-skus").innerText()).replace(/[^\d]/g,""))>0,"Current SKU count must be rendered");
 assert.equal(await page.locator(".catalog-report").count(),4,"Quality reports must render");
 assert.equal(await page.locator("#catalog-error").isHidden(),true);
 await page.locator(".catalog-table-item").filter({has:page.locator("code", {hasText:"product_specs"})}).first().click();
 assert.ok((await page.locator("#catalog-detail").innerText()).includes("product_specs"));
 assert.ok((await page.locator("#catalog-detail").innerText()).includes("specs"));
 assert.ok((await page.locator(".catalog-field-table tbody tr").count())>5);
 await page.locator("[data-lang=us]").click();
 assert.ok((await page.locator("#catalog-browser-title").innerText()).includes("Per-table"));
 await page.locator("[data-lang=kr]").click();
 await page.locator("#catalog-search").fill("refresh_state");
 const matches=await page.locator(".catalog-table-item code").allInnerTexts();
 assert.ok(matches.includes("refresh_state"),"Search must expose the named mart");
 assert.ok(matches.length>0 && matches.length<12,"Search must narrow down the set of marts");
 await page.locator("#catalog-search").fill("");
 await page.locator(".catalog-filter[data-layer=B]").click();
 assert.ok((await page.locator(".catalog-table-item").count())>=2,"Versioned tables must be selectable");
 await page.locator(".catalog-filter[data-layer=all]").click();
 // No-network fallback: snapshot embedded at build time must render even when
 // the manifest request is blocked or GitHub Pages CDN temporarily fails.
 await page.route("**/data/catalog/kr.json",route=>route.abort("failed"));
 await page.reload({waitUntil:"domcontentloaded"});
 await page.locator(".catalog-table-item").first().waitFor({timeout:12000});
 assert.equal(await page.locator(".catalog-table-item").count(),12,"Embedded bootstrap must survive network failure");
 assert.equal(await page.locator("#catalog-error").isHidden(),true);
 assert.deepEqual(errors,[],"Browser errors: "+errors.join("\n"));
 // AI-ready registry: all 36 marts must be discoverable without search.
 await page.goto("http://127.0.0.1:"+port+"/registry.html",{waitUntil:"domcontentloaded"});
 await page.locator("details.registry-mart").first().waitFor({timeout:12000});
 assert.equal(await page.locator("details.registry-mart").count(),36,"Registry must list all 36 marts");
 assert.equal(await page.locator(".registry-domain").count(),8,"Registry must group into eight domains");
 assert.equal(await page.locator("#registry-error").isHidden(),true,"Registry schema must load");
 await page.locator("details.registry-mart").first().locator("summary").click();
 assert.equal(await page.locator("details.registry-mart").first().getAttribute("open"),"","First mart must expand");
 assert.ok((await page.locator("details.registry-mart").first().innerText()).includes("Primary Key"));
 await page.locator("#expand-all").click();
 assert.equal(await page.locator("details.registry-mart[open]").count(),36,"Expand all must work");
 await page.locator("[data-lang=us]").click();
 assert.equal(await page.locator("details.registry-mart[open]").count(),36,"Language toggle must preserve expansion");
 await page.locator("#collapse-all").click();
 assert.equal(await page.locator("details.registry-mart[open]").count(),0,"Collapse all must work");
 assert.deepEqual(errors,[],"Registry browser errors: "+errors.join("\\n"));
 // Header regression: all six public pages must render the same four links
 // in the same order. Navigating between them must not add/drop a menu item.
 const expectedKeys=["navOverview","navSpec","navAiData","navConnect"];
 const expectedHrefs=["./","./registry.html","./ai-data.html","./#connect"];
 const routes=["index.html","status.html","catalog.html","registry.html","explorer.html","ai-data.html"];
 const actualBase="http://127.0.0.1:"+port+"/";
 for(const language of ["kr","us"]){
   for(const route of routes){
     await page.goto(actualBase+route,{waitUntil:"domcontentloaded"});
     await page.waitForFunction(()=>Boolean(window.ScomSite?.language));
     if((await page.evaluate(()=>window.ScomSite.language()))!==language){
       await page.locator("[data-lang="+language+"]").click();
     }
     const nav=await page.locator(".main-nav > a").evaluateAll(links=>links.map(link=>({
       href:link.getAttribute("href"),key:link.dataset.i18n,text:link.textContent.trim()
     })));
     assert.deepEqual(nav.map(link=>link.href),expectedHrefs,"Menu href drift in "+route+" / "+language);
     assert.deepEqual(nav.map(link=>link.key),expectedKeys,"Menu order drift in "+route+" / "+language);
     assert.ok(nav.every(link=>link.text.length>0),"Missing translated menu label in "+route);
     if(language==="us")assert.equal(nav[1].text,"AI-Ready Schema","Schema label must translate on "+route);
     else assert.equal(nav[1].text,"AI-Ready 명세","Schema label must be Korean on "+route);
   }
 }
 console.log("PASS: 12 raw source marts and verified constant four-link KR/US navigation across all five pages.");
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
