/**
 * Conservative, SKU-scoped PDP specification extraction.
 * Never infer shared specifications from a category listing or marketing name.
 * Caller must verify the exact SKU on the product detail page.
 */
export const specLabelPatterns = [
  /(?:^|\s)(?:크기|사이즈|치수|dimensions?|width|height|depth|무게|중량|weight)(?:$|\s|\()/i,
  /^(?:전체\s*용량|용량|총용량|정격용량|저장용량|냉장실|냉동실|capacity|storage)/i,
  /(?:디스플레이|화면|해상도|화질|패널|주사율|밝기|screen|resolution|display|refresh rate)/i,
  /(?:소비전력|정격전압|전원|에너지\s*(?:소비효율|등급)|냉방능력|난방능력|power consumption|energy efficiency)/i,
  /(?:채널|오디오\s*출력|정격출력|스피커|블루투스|와이파이|Wi-?Fi|Bluetooth|speaker|audio output|channels?)/i,
  /(?:배터리|충전|재생\s*시간|동작\s*시간|battery|playtime|charging)/i,
  /(?:모델명|모델코드|제품명|제품코드|model name|model code)/i,
  /(?:물\s*소비량|소음|소음도|효율|건조|세탁|모터|compressor|noise|water consumption)/i,
  /(?:인치|화면\s*크기|무풍|설치\s*타입|냉매|에어컨\s*타입|IP\s*등급)/i
];

export function normalizeSpecPair(pair) {
  const name = String(pair?.name || "").replace(/\s+/g, " ").trim();
  const value = String(pair?.value || "").replace(/\s+/g, " ").trim();
  if (!name || !value || name===value) return null;
  if (name.length > 75 || value.length > 180) return null;
  if (!specLabelPatterns.some(rx=>rx.test(name))) return null;
  if (/^(?:-|—|N\/?A|해당없음|미정|선택하세요|더보기|자세히|보기|기준가|SKU|구매하기|loading)$/i.test(value)) return null;
  if (/https?:\/\/|\{\{|\}\}|<[^>]+>|결제|쿠폰|장바구니|고객센터|개인정보/.test(value)) return null;
  if (/^(?:\d{1,3}[,.]?\d*\s*원|₩|\$)/.test(value)) return null;
  if (!/[\p{L}\d]/u.test(value)) return null;
  if (!/[\d]/.test(value) && !/^(?:있음|없음|지원|미지원|예|아니오|키친핏|스탠드|벽걸이|슬림|OLED|QLED|LED|LCD|IPS|VA|Bluetooth|Wi-?Fi|유선|무선|인버터)$/i.test(value)) return null;
  return {name,value,source:"samsung_pdp_verified"};
}

export function sanitizePdpPairs(pairs, sku, pageUrl, pageText) {
  const expected=String(sku||"").trim().toUpperCase();
  if (!expected) return {verified:false,specs:[],reason:"missing_expected_sku"};
  let actual="";
  try {
    const url=new URL(pageUrl);
    if(url.hostname!=="www.samsung.com"||url.protocol!=="https:")return {verified:false,specs:[],reason:"non_official_pdp"};
    actual=decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1)||"").toUpperCase();
  } catch {return {verified:false,specs:[],reason:"invalid_pdp_url"};}
  if(actual!==expected)return {verified:false,specs:[],reason:"pdp_sku_mismatch"};
  // Require first-screen "SKU <exact-model>" evidence, not mere recommendations.
  const header=String(pageText||"").slice(0,6500);
  const declared=header.match(/(?:^|\n|\s)SKU\s*[:：]?\s*([A-Z0-9/-]{5,40})(?=\s|$)/i)?.[1];
  if(String(declared||"").toUpperCase()!==expected)
    return {verified:false,specs:[],reason:"sku_not_declared_on_pdp"};

  const seen=new Set(),specs=[];
  for(const item of pairs||[]){
    const spec=normalizeSpecPair(item);
    if(!spec)continue;
    const signature=spec.name.toLowerCase()+"|"+spec.value.toLowerCase();
    if(seen.has(signature))continue;
    seen.add(signature);specs.push(spec);
    if(specs.length>=80)break;
  }
  return {verified:true,specs,reason:specs.length?"ok":"no_valid_pdp_pairs"};
}

/** Interleave categories so large appliance catalogs cannot starve HARMAN/VD.
 * Revisit unsuccessful targets after 24h, and never share evidence across SKUs.
 */
export function selectCrossBuSpecTargets(rows,attempts={},now=Date.now(),limit=12) {
  const buckets=new Map();
  for (const row of rows||[]) {
    if(["smartphones","watches"].includes(row.catalog_category))continue;
    const sku=String(row.sku||"").toUpperCase();
    if(!sku || !row.product_detail_url || row.product_detail_url===row.catalog_source_url)continue;
    if(Array.isArray(row.specs) && row.specs.length)continue;
    if(!["current_sellable","current_out_of_stock","current_not_directly_sellable"].includes(row.lifecycle_status))continue;
    const recent=attempts[sku];
    if(recent?.checked_at && Number.isFinite(Date.parse(recent.checked_at)) &&
      now-Date.parse(recent.checked_at) < (recent.status==="enriched"?7:24)*3600000)continue;
    const bu=row.catalog_category==="harman-lifestyle-audio"?"HARMAN":String(row.business_unit||"");
    const bucketKey=String(row.catalog_source_id||row.catalog_category||"other");
    const key=bu==="HARMAN"?"HARMAN":(["DA","VD","MX"].includes(row.business_unit)?row.business_unit:"OTHER");
    if(!buckets.has(key))buckets.set(key,new Map());
    const groups=buckets.get(key);
    if(!groups.has(bucketKey))groups.set(bucketKey,[]);
    groups.get(bucketKey).push(row);
  }
  const queues=new Map();
  for(const [bu,groups] of buckets){
    for(const bucket of groups.values())bucket.sort((a,b)=>{
      const ap=a.lifecycle_status==="current_sellable"?0:1,bp=b.lifecycle_status==="current_sellable"?0:1;
      return ap-bp || String(a.sku).localeCompare(String(b.sku));
    });
    queues.set(bu,[...groups.values()].sort((a,b)=>a.length-b.length));
  }
  const selected=[],seen=new Set(),orderedBus=["DA","VD","MX","HARMAN","OTHER"];
  while(selected.length<limit && [...queues.values()].some(groups=>groups.some(g=>g.length))){
    for(const bu of orderedBus){
      if(selected.length>=limit)break;
      const groups=queues.get(bu)||[];
      if(!groups.length)continue;
      let row;
      for(let i=0;i<groups.length;i++){
        const group=groups.shift();
        if(!group.length){groups.push(group);continue;}
        row=group.shift();
        groups.push(group);
        break;
      }
      if(!row||seen.has(row.sku))continue;
      seen.add(row.sku);selected.push(row);
    }
  }
  return selected;
}
