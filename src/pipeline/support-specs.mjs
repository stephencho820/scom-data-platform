/**
 * Extract official Samsung KR model-support specifications with conservative
 * model-affinity verification. Never assume every support URL exists.
 * The URL must address the requested SKU and the page must visibly identify
 * the same exact SKU or a known Samsung variant-neutral model alias.
 */
const norm=value=>String(value||"").trim().toUpperCase().replace(/\s+/g,"");
const flatten=value=>norm(value).replace(/[^A-Z0-9]/g,"");

export function modelAliases(sku){
  const exact=flatten(sku);
  const base=[exact];
  // Support sometimes shows a neutral code like S27C900PAK for
  // catalog SKU LS27C900PAKXKR, removing regional suffix and retail L.
  for(const suffix of ["XXKR","XKR","KOO","KOD"]){
    if(exact.endsWith(suffix) && exact.length-suffix.length>=9)
      base.push(exact.slice(0,-suffix.length));
  }
  if(exact.startsWith("LS") && exact.length>=11){
    for(const value of [...base]){
      if(value.startsWith("LS") && value.length>9)base.push(value.slice(1));
    }
  }
  return [...new Set(base.filter(code=>code.length>=9))];
}
export function supportModelUrl(sku){
  const value=String(sku||"").trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9/-]{5,40}$/.test(value))return "";
  return "https://www.samsung.com/sec/support/model/"+encodeURIComponent(value)+"/";
}
function officialSupportUrl(url,sku){
  try{
    const parsed=new URL(url);
    return parsed.protocol==="https:"&&parsed.hostname==="www.samsung.com" &&
      /^\/sec\/support\/model\/[^/]+\/?$/i.test(parsed.pathname) &&
      norm(decodeURIComponent(parsed.pathname.split("/").filter(Boolean).at(-1)))===norm(sku);
  }catch{return false;}
}
function cleanLine(value){
  return String(value||"").replace(/^\s*\d{1,3}\s*[.)]\s*/,"").replace(/\s+/g," ").trim();
}
const categories=/^(?:디스플레이|스마트|기능|입출력 및 연결성|음향|동작조건|특수 기능|디자인|환경|전원|크기|무게|액세서리|인증정보|냉장고|냉동고|성능|사양|제품 사양|기본 사양|일반|규격|연결성|에너지|전기 사양|오디오|네트워크|설치|세탁|건조|기타|배터리)$/i;
const label=/화면|패널|밝기|명암|해상도|응답속도|시야각|색재현|주사율|픽셀|인치|디스플레이|입력|HDMI|DP|USB|HDCP|Thunderbolt|Wi.?Fi|블루투스|스피커|채널|출력|소비전력|정격|전원|무게|사이즈|치수|스탠드|크기|높이|폭|깊이|색상|컬러|용량|냉장|냉동|제빙|온도|전압|전류|효율|등급|소음|세탁|건조|물 소비|습도|공기청정|필터|인증|패턴|절전|배터리|재생 시간|충전|속도|세대|표준|모드|공간|디스플레이|프로세서|메모리|스토리지|운영체제|소재|코어|유선|무선|냉방|난방|면적|대역|주파수|안테나|네트워크|해상도|스마트|원격|게임|모니터|화질|픽셀|무풍|드럼|에어컨/i;
const stop=/^(?:워런티 정보|제품 지원|온라인 상담|전화 상담|방문 상담|서비스센터 찾기|기획전|카테고리|고객지원|리뷰|고객센터|확인|매뉴얼 & 다운로드)$/i;
function validValue(value){
  const s=cleanLine(value);
  return Boolean(s&&s.length<=200&&/[가-힣A-Za-z0-9]/.test(s) &&
    !/^(?:자세히보기|닫기|보기|스펙|더보기|확인|입력|찾기|N\/A|해당 없음|—|-|갤럭시|삼성 대한민국)$/i.test(s) &&
    !/https?:|쿠폰|원\s*$|장바구니|멤버십|개인정보|고객센터/.test(s));
}
function valueOrNull(name,value){
  const n=cleanLine(name),v=cleanLine(value);
  if(!n||!v||n===v||n.length>85||!label.test(n)||categories.test(n))return null;
  if(!validValue(v)||label.test(v)&&v.length>45)return null;
  return {key:n.toLowerCase().replace(/[^a-z0-9가-힣]+/g,"_").slice(0,80),name:n,value:v,source:"samsung_support_verified"};
}

/** Parses already-rendered visible text; supports Samsung's indexed spec lines
 * and one-label/one-value DOM layout. Includes no title/marketing-derived facts.
 */
export function parseSupportSpecText(text){
  const lines=String(text||"").replace(/\r/g,"").split("\n").map(cleanLine);
  const markers=[];
  lines.forEach((line,i)=>{if(/^(?:스펙|Specifications|Technical Specifications)$/i.test(line))markers.push(i);});
  if(!markers.length)return [];
  // The second heading is usually the accordion content; whichever yields
  // the most technical pairs inside the bounded "spec" section is used.
  let best=[];
  for(const start of markers.slice(0,8)){
    const pairs=[],seen=new Set();
    let sectionStarted=false;
    for(let i=start+1;i<Math.min(lines.length,start+420);i++){
      const name=lines[i];
      if(!name)continue;
      if(stop.test(name)&&sectionStarted)break;
      if(/^(?:스펙|Specifications)$/i.test(name))continue;
      if(categories.test(name)){sectionStarted=true;continue;}
      if(!label.test(name) || name.length>86 || i+1>=lines.length)continue;
      const next=lines.slice(i+1,i+5).find(Boolean);
      if(!next || stop.test(next) || categories.test(next))continue;
      const pair=valueOrNull(name,next);
      if(!pair)continue;
      sectionStarted=true;
      const key=pair.name+"|"+pair.value;
      if(seen.has(key))continue;
      seen.add(key);pairs.push(pair);
    }
    if(pairs.length>best.length)best=pairs;
  }
  return best.slice(0,100);
}
export function supportSpecEvidence({sku,url,text}){
  if(!officialSupportUrl(url,sku))
    return {verified:false,reason:"support_url_mismatch",specs:[]};
  const body=String(text||"");
  if(!/매뉴얼\s*(?:&|및)\s*다운로드/i.test(body)||!/(?:^|\n)\s*스펙\s*(?:\n|$)/i.test(body))
    return {verified:false,reason:"not_a_support_spec_page",specs:[]};
  const marker=body.search(/(?:^|\n)\s*스펙\s*(?:\n|$)/i);
  const header=body.slice(0,Math.max(0,marker)).slice(-2800);
  const aliases=modelAliases(sku);
  const lines=header.split(/\r?\n/).map(flatten);
  const declared=aliases.find(alias=>lines.some(line=>line===alias || (line.length>=9&&line.endsWith("("+alias+")"))));
  if(!declared)return {verified:false,reason:"support_model_not_confirmed",specs:[]};
  const specs=parseSupportSpecText(body);
  if(specs.length<3)return {verified:false,reason:"support_specs_missing_or_sparse",specs:[],source_model:declared};
  return {verified:true,reason:"ok",source_model:declared,match_type:declared===flatten(sku)?"exact":"model_family_alias",specs};
}
