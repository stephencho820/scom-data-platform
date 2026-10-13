/* This page reads published repo files only; no hardcoded success counts. */
const ROOT="./data/marts/kr/";
const t=key=>window.ScomSite.t(key);
let dataset=null;
const node=(name,className,text)=>{const el=document.createElement(name);if(className)el.className=className;if(text!=null)el.textContent=text;return el;};
const fmt=n=>typeof n==="number"&&Number.isFinite(n)?n.toLocaleString(window.ScomSite.language()==="kr"?"ko-KR":"en-US"):"—";
function metric(parent,label,value){
  const el=node("div","status-metric");el.append(node("small","",t(label)),node("strong","",value));parent.append(el);
}
function line(parent,label,value,good=null){
  const el=node("div","status-row");const name=node("span","",label),result=node("b",good===null?"":good?"status-pass":"status-fail",value);el.append(name,result);parent.append(el);
}
function statusDate(iso){const n=Date.parse(iso||"");return Number.isFinite(n)?new Date(n).toLocaleString(window.ScomSite.language()==="kr"?"ko-KR":"en-US"):"—";}
function render(){
  if(!dataset)return;
  const {readiness,coverage,incremental}=dataset;
  const complete=readiness.ready===true&&coverage.complete===true;
  const pill=document.getElementById("status-pill");
  pill.textContent=t(complete?"statusReady":"statusNotReady");pill.classList.toggle("is-good",complete);
  document.getElementById("status-updated").textContent=t("statusSnapshot")+": "+statusDate(readiness.generated_at);
  const counts=readiness.counts||{},meta=coverage||{};
  const cards=document.getElementById("status-metrics");cards.replaceChildren();
  metric(cards,"metricRegistered",fmt(counts.sku_registry));
  metric(cards,"metricCurrent",fmt(counts.current_skus));
  metric(cards,"metricSpecs",fmt(counts.current_skus_with_specs));
  metric(cards,"metricSources",fmt(meta.catalog_sources_ok)+" / "+fmt(meta.catalog_sources_total));

  const gates=document.getElementById("status-gates");gates.replaceChildren();
  for(const [key,passed] of Object.entries(readiness.gates||{}))line(gates,t("gate_"+key),t(passed?"passed":"pending"),passed);

  const sync=document.getElementById("status-sync");sync.replaceChildren();
  document.getElementById("status-sync-time").textContent=incremental
    ? t("statusSyncRun")+": "+statusDate(incremental.checked_at)
    : t("statusChangesEmpty");
  if(incremental?.stats){
    line(sync,t("statusSyncNew"),fmt(incremental.stats.new_skus));
    line(sync,t("statusSyncSpecs"),fmt(incremental.stats.specs_enriched_or_corrected));
    line(sync,t("statusSyncOffers"),fmt(incremental.stats.offers_changed));
    line(sync,t("statusSyncChecked"),fmt(incremental.stats.offers_verified));
  }
  const tbody=document.getElementById("status-categories");tbody.replaceChildren();
  for(const row of coverage.categories||[]){
    const tr=node("tr");
    for(const value of [(row.business_unit||"OTHER")+" / "+(row.category||""),fmt(row.discovered_unique_skus),fmt(row.db_current_unique_skus),row.complete?t("passed"):t("pending")]){
      tr.append(node("td","",value));
    }
    const source=node("td");
    try{const url=new URL(row.source_url);if(url.protocol==="https:"&&url.hostname==="www.samsung.com"){
      const link=node("a","", "↗");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";source.append(link);
    }}catch{}
    tr.append(source);tbody.append(tr);
  }
}
async function load(){
  try{
    const [a,b,c]=await Promise.all([
      fetch(ROOT+"chatbot_readiness.json",{cache:"no-store"}),
      fetch(ROOT+"current_catalog_coverage.json",{cache:"no-store"}),
      fetch(ROOT+"incremental_report.json",{cache:"no-store"})
    ]);
    if(!a.ok||!b.ok)throw Error("Readiness files missing");
    dataset={readiness:await a.json(),coverage:await b.json(),incremental:c.ok?await c.json():null};
    render();
  }catch(error){
    document.getElementById("status-pill").textContent=t("statusUnavailable");
    document.getElementById("status-updated").textContent=t("statusError");
    const gate=document.getElementById("status-gates");gate.replaceChildren(node("p","status-error",t("statusError")));
  }
}
window.ScomSite.onLanguageChange(render);
load();
