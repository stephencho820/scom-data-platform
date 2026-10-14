/* Keep catalog internals out of the global scope shared with site.js. */
(function catalogPageController(){
"use strict";
/**
 * Data Catalog UI. Reads one published manifest generated from the real marts.
 * Text-only DOM rendering prevents a stored source value from injecting HTML.
 */
let catalogData=null, layer="all", query="", selected="product_master";
const $=id=>document.getElementById(id);
const t=key=>window.ScomSite.t(key);
const lang=()=>window.ScomSite.language();
const local=obj=>obj?.[lang()]||obj?.kr||"";
const fmt=value=>Number(value||0).toLocaleString(lang()==="kr"?"ko-KR":"en-US");
const stamp=value=>{
 const time=Date.parse(value||"");
 return Number.isFinite(time)?new Intl.DateTimeFormat(lang()==="kr"?"ko-KR":"en-US",{dateStyle:"medium",timeStyle:"short"}).format(time):"—";
};
function el(tag,cls,value){
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(value!==undefined)n.textContent=String(value);
 return n;
}
function place(parent,...children){children.forEach(x=>parent.append(x));return parent;}
function gitUrl(file){
 if(!/^(?:data\/marts\/kr|data\/history\/(?:products|offers|commerce_options))\/[a-z0-9_-]+\.(?:json|jsonl)$/.test(file||""))return null;
 return "https://github.com/stephencho820/scom-data-platform/blob/main/"+file;
}
function sourceLink(file,label){
 const link=el("a","catalog-source-link",label+" ↗");
 const url=gitUrl(file);
 if(!url)return el("span","",label);
 link.href=url;link.target="_blank";link.rel="noopener noreferrer";
 return link;
}
function pill(value){
 const p=el("span","catalog-type-pill",value);
 p.dataset.layer=value;
 return p;
}
function updateSummary(){
 if(!catalogData)return;
 const counts=catalogData.readiness.counts||{};
 const amount=catalogData.tables.length;
 $("catalog-stat-tables").textContent=fmt(amount);
 $("catalog-stat-skus").textContent=fmt(counts.current_skus);
 $("catalog-stat-specs").textContent=fmt(counts.current_skus_with_specs);
 $("catalog-stat-support").textContent=fmt(counts.support_linked_current_skus);
 const percent=counts.current_skus?100*(counts.current_skus_with_specs||0)/counts.current_skus:0;
 $("catalog-stat-specs-rate").textContent=percent.toFixed(1)+"% · "+t("catalogStatSpecRate");
 $("catalog-snapshot-date").textContent=stamp(catalogData.snapshot_at);
 const badge=$("catalog-readiness");badge.textContent=catalogData.readiness.ready?t("statusReady"):t("statusNotReady");
 badge.classList.toggle("is-ready",catalogData.readiness.ready);
}
function filteredTables(){
 if(!catalogData)return [];
 const q=query.trim().toLowerCase();
 return catalogData.tables.filter(row=>(layer==="all"||row.layer===layer) && (
  !q||[row.id,local(row.title),local(row.desc),...row.columns.map(f=>f.name)].some(s=>String(s||"").toLowerCase().includes(q))
 ));
}
function updateControls(){
 const search=$("catalog-search");if(search)search.placeholder=t("catalogSearchPlaceholder");
 document.querySelectorAll("[data-layer].catalog-filter").forEach(button=>{
  const active=button.dataset.layer===layer;
  button.classList.toggle("is-active",active);
  button.setAttribute("aria-pressed",String(active));
 });
}
function renderList(){
 const rows=filteredTables();
 if(!rows.some(row=>row.id===selected))selected=rows[0]?.id||null;
 const list=$("catalog-table-list");list.replaceChildren();
 $("catalog-list-count").textContent=fmt(rows.length)+" "+t("catalogCountLabel");
 if(!rows.length){list.append(el("p","catalog-empty",t("catalogNoResults")));return;}
 for(const row of rows){
  const button=el("button","catalog-table-item"+(row.id===selected?" is-active":""));
  button.type="button";button.setAttribute("aria-pressed",String(row.id===selected));
  const left=el("span");
  left.append(el("strong","",local(row.title)),el("code","",row.id));
  const right=el("span","catalog-table-item-right");
  right.append(pill(row.layer),el("span","catalog-item-count",fmt(row.row_count)));
  button.append(left,right);
  button.addEventListener("click",()=>{selected=row.id;renderList();renderDetail();});
  list.append(button);
 }
}
function detailMetric(key,value){
 const div=el("div","catalog-detail-metric");
 div.append(el("span","",t(key)),el("strong","",value));
 return div;
}
function section(title,right){
 const heading=el("div","catalog-detail-sect");
 heading.append(el("h4","",t(title)));
 if(right)heading.append(right);
 return heading;
}
function renderDetail(){
 const target=$("catalog-detail");target.replaceChildren();
 const row=catalogData?.tables.find(r=>r.id===selected);
 if(!row){target.append(el("p","catalog-empty",t("catalogNoResults")));return;}
 const top=el("div","catalog-detail-header");
 const h=el("div");h.append(pill(row.layer),el("h3","",local(row.title)),el("code","catalog-table-code",row.id));
 top.append(h,sourceLink(row.file,t("catalogSource")));
 target.append(top,el("p","catalog-detail-description",local(row.desc)));
 const details=el("div","catalog-detail-metrics");
 details.append(
  detailMetric("catalogDetailRows",fmt(row.row_count)+" "+t("catalogRowsSuffix")),
  detailMetric("catalogDetailGrain",local(row.grain)),
  detailMetric("catalogDetailKey",row.pk||"—"),
  detailMetric("catalogDetailRefresh",local(row.refresh)),
  detailMetric("catalogDetailCols",fmt(row.columns.length)),
  detailMetric("catalogDetailJoin",row.foreign.length?row.foreign.join(", "):"—")
 );
 target.append(details);
 const commands=el("p","catalog-tools",t("catalogDetailTools")+": "+row.tools.join(" · "));
 target.append(commands);
 const columns=el("small","",fmt(row.columns.length)+" "+t("catalogFieldsUnit"));
 target.append(section("catalogFieldsTitle",columns));
 const wrap=el("div","catalog-field-table-wrap");const table=el("table","catalog-field-table");
 const thead=el("thead"),theadRow=el("tr");
 ["catalogFieldName","catalogFieldType","catalogFieldDescription","catalogFieldFill"].forEach(k=>theadRow.append(el("th","",t(k))));
 thead.append(theadRow);table.append(thead);
 const tbody=el("tbody");
 for(const field of row.columns){
  const tr=el("tr"),name=el("td");name.append(el("code","",field.name));
  const ratio=field.present?100*field.populated/field.present:0;
  const fill=el("td");const pct=el("span","",ratio.toFixed(0)+"%");
  const prog=el("div","catalog-progress"),bar=el("i");
  bar.style.width=ratio.toFixed(2)+"%";prog.append(bar);
  fill.append(pct,prog);
  tr.append(name,el("td","catalog-field-type",field.type),el("td","",local(field.description)),fill);
  tbody.append(tr);
 }
 table.append(tbody);wrap.append(table);target.append(wrap);
 const sampleControls=el("div","catalog-sample-controls");
 const copy=el("button","catalog-copy",t("catalogCopy"));copy.type="button";
 copy.addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(JSON.stringify(row.sample,null,2));copy.textContent=t("catalogCopied");setTimeout(()=>{copy.textContent=t("catalogCopy");},1500);}catch{copy.textContent=t("catalogCopyError");}
 });
 sampleControls.append(copy);
 target.append(section("catalogSampleTitle",sampleControls));
 target.append(el("p","catalog-preview-note",t("catalogSampleNote")));
 const pre=el("pre","catalog-sample");
 pre.append(el("code","",row.sample?JSON.stringify(row.sample,null,2):t("catalogNoSample")));
 target.append(pre);
}
const reportCopy={
 chatbot_readiness:{kr:"챗봇 READY 판정",us:"Chatbot readiness gates"},
 current_catalog_coverage:{kr:"카탈로그 대조 보고서",us:"Catalog coverage audit"},
 incremental_report:{kr:"최근 증분 처리 결과",us:"Incremental sync report"},
 quality_backlog:{kr:"누락 데이터 개선 목록",us:"Data quality backlog"}
};
function renderReports(){
 const container=$("catalog-report-list");container.replaceChildren();
 if(!catalogData)return;
 for(const report of catalogData.reports){
  const card=el("div","catalog-report");
  card.append(el("strong","",local(reportCopy[report.id])||report.id));
  card.append(el("small","",report.id+".json"));
  card.append(sourceLink(report.source_file,t("catalogSource")));
  container.append(card);
 }
}
function render(){
 updateControls();
 if(!catalogData)return;
 updateSummary();renderList();renderDetail();renderReports();
}
function bootstrapped(){
 const node=$("catalog-bootstrap");
 if(!node)return null;
 try{const data=JSON.parse(node.textContent||"{}");return data?.schema_version===1&&data.market==="kr"&&Array.isArray(data.tables)?data:null;}
 catch{return null;}
}
async function loadManifest(){
 const error=$("catalog-error");
 if(error)error.hidden=true;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
 try{
  const res=await fetch("./data/catalog/kr.json",{cache:"no-store",signal:controller.signal});
  if(!res.ok)throw Error("HTTP "+res.status);
  const doc=await res.json();
  if(doc?.schema_version!==1||doc.market!=="kr"||!Array.isArray(doc.tables))throw Error("Unsupported data catalog");
  catalogData=doc;render();
 }catch{
  if(!catalogData){if(error)error.hidden=false;$("catalog-table-list").replaceChildren(el("p","catalog-empty",t("catalogLoadFailed")));$("catalog-detail").replaceChildren();}
 }finally{clearTimeout(timer);}
}
$("catalog-search")?.addEventListener("input",event=>{query=event.currentTarget.value;render();});
document.querySelectorAll(".catalog-filter").forEach(button=>button.addEventListener("click",()=>{layer=button.dataset.layer;render();}));
$("catalog-retry")?.addEventListener("click",loadManifest);
window.ScomSite.onLanguageChange(render);
catalogData=bootstrapped();
render();
loadManifest();

})();
