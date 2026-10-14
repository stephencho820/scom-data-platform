/** Materialize only contract-backed, source-traceable AI-ready records. No invented values. */
import {readFile,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
const root=process.cwd(),market=(process.argv[2]||"kr").toLowerCase();
const out=path.resolve(process.argv[3]||"data/ai-ready/"+market);
const registry=JSON.parse(await readFile(path.join(root,"schemas/ai_ready_mart_registry_v1.json"),"utf8"));
async function rows(table){try{return (await readFile(path.join(root,"data/marts",market,table+".jsonl"),"utf8")).split(/\r?\n/).filter(Boolean).map(JSON.parse)}catch{return []}}
const sources={P01:["product_master",{sku:"sku",model_code:"model",division:"business_unit",category_id:"category",product_name:"name",lifecycle_status:"lifecycle_status",product_url:"product_url"}],P04:["product_master",{sku:"sku",model_code:"model",variant_options:"variant_attributes"}]};
const present=v=>v!==null&&v!==undefined&&v!==""&&(!Array.isArray(v)||v.length>0)&&(!(typeof v==="object"&&!Array.isArray(v))||Object.keys(v).length>0);
const manifest={schema_version:1,market,generated_at:new Date().toISOString(),status:"PARTIAL_NOT_VERIFIED",contract_registry_version:registry.schema_version,marts:[]};
await mkdir(out,{recursive:true});
for(const contract of registry.marts){
 if(contract.id==="P02"){
  const input=await rows("product_specs"),result=[],seen=new Set();let skippedEmpty=0,skippedInvalid=0,duplicates=0;
  for(const row of input){
   const sku=row.sku,sourceUrl=row.source_url;
   if(!present(sku)||!present(row.market_product_key)||!Array.isArray(row.specs)||!row.specs.length){skippedEmpty++;continue}
   if(!present(sourceUrl)||!/^https:\/\/www\\.samsung\\.com\//i.test(sourceUrl)){skippedInvalid++;continue}
   for(const spec of row.specs){
    if(!spec||typeof spec!=="object"){skippedInvalid++;continue}
    const specKey=spec.key,rawValue=spec.value;
    if(!present(specKey)||!present(rawValue)||!(typeof rawValue==="string"||typeof rawValue==="number")){skippedInvalid++;continue}
    const key=market+"|"+sku+"|"+specKey;
    if(seen.has(key)){duplicates++;continue}seen.add(key);
    const data={sku,spec_key:String(specKey),raw_value:rawValue};
    if(present(spec.unit)&&typeof spec.unit==="string")data.unit=spec.unit;
    if(present(row.source_model))data.source_model_code=row.source_model;
    data.model_match_status=row.source_model&&row.model&&row.source_model===row.model?"exact":"unverified";
    result.push({contract_id:"P02",market,sku,data,provenance:{source_table:"product_specs",source_product_key:row.market_product_key,source_url:sourceUrl,source_collected_at:row.captured_at||null},verification_status:"unverified",data_status:"unverified",schema_version:registry.schema_version});
   }
  }
  await writeFile(path.join(out,"P02.jsonl"),result.map(x=>JSON.stringify(x)).join("\n")+(result.length?"\n":""));
  manifest.marts.push({id:"P02",status:result.length?"MATERIALIZED_UNVERIFIED":"NO_ELIGIBLE_RECORDS",rows:result.length,source_table:"product_specs",skipped_empty_rows:skippedEmpty,skipped_invalid_facts:skippedInvalid,duplicate_spec_keys:duplicates,verification:"NOT_ASSESSED",note:"Only nonempty key/value specs with a Samsung.com source URL. No inference or unit normalization."});
  continue;
 }
 const definition=sources[contract.id];if(!definition){manifest.marts.push({id:contract.id,status:"NOT_MATERIALIZED",rows:0,reason:"No verified field-level transformation defined"});continue}
 const [source,mapping]=definition,input=await rows(source),result=[];const keys=new Set();
 for(const row of input){const sku=row.sku;if(!present(sku)||!present(row.market_product_key))continue;const data={};for(const f of contract.fields){const alias=mapping[f.name];if(alias&&present(row[alias]))data[f.name]=row[alias]}
 if(!contract.fields.filter(f=>f.required).every(f=>present(data[f.name])))continue;
 const key=market+":"+sku;if(keys.has(key))continue;keys.add(key);
 const provenance={source_table:source,source_product_key:row.market_product_key,source_url:row.product_url||null,source_collected_at:row.collected_at||null};
 result.push({contract_id:contract.id,market,sku,data,provenance,verification_status:"unverified",data_status:"unverified",schema_version:registry.schema_version});
 }
 await writeFile(path.join(out,contract.id+".jsonl"),result.map(x=>JSON.stringify(x)).join("\n")+(result.length?"\n":""));
 manifest.marts.push({id:contract.id,status:result.length?"MATERIALIZED_UNVERIFIED":"NO_ELIGIBLE_RECORDS",rows:result.length,source_table:source,fields:Object.keys(mapping)});
}
await writeFile(path.join(out,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({market,materialized:manifest.marts.filter(x=>x.rows>0).map(x=>({id:x.id,rows:x.rows})),total_contracts:manifest.marts.length}));
