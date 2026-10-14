/** Conservative field-level gap analysis against the published observed-data catalog.
 * Evidence of source columns is NOT evidence of verified business facts or READY.
 */
import {readFile,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
const root=process.cwd(), read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const registry=await read("schemas/ai_ready_mart_registry_v1.json");
const catalog=await read(process.argv[2]||"dist/data/catalog/kr.json");
const mapping={"P01":[["product_master",{"sku":"sku","model_code":"model","division":"business_unit","category_id":"category","product_name":"name","lifecycle_status":"lifecycle_status","product_url":"product_url"}]],"P02":[["product_specs",{"sku":"sku","spec_key":"specs[].key","raw_value":"specs[].value","unit":"specs[].unit","source_model_code":"source_model"}]],"P04":[["product_master",{"sku":"sku","model_code":"model","variant_options":"variant_attributes"}]],"P07":[["product_master",{"sku":"sku","sales_status":"lifecycle_status"}]],"C01":[["market_offers",{"sku":"sku","sale_price":"price","currency":"currency"}]],"C02":[["catalog_current",{"sku":"sku","availability_status":"availability","stock_status":"catalog_stock_qty"}]],"C05":[["commerce_options",{"credit_rule":"trade_in"}]],"C06":[["market_offers",{"benefit_value":"promotions"}]],"C07":[["market_offers",{"conditions":"promotions"}]],"C08":[["commerce_options",{"delivery_type":"delivery"}]],"C09":[["commerce_options",{"installation_type":"installation"}]],"S01":[["commerce_options",{"plan_type":"subscriptions"}]],"S03":[["commerce_options",{"benefit_type":"subscriptions"}]],"U01":[["commerce_options",{"benefit":"membership"}]],"H01":[["support_resources",{"document_id":"support_key","content":"description"}]]};
const byId=new Map((catalog.tables||[]).map(t=>[t.id,t]));
const results=registry.marts.map(m=>{
 const sources=(mapping[m.id]||[]).map(([table,fields])=>{
  const observed=byId.get(table), cols=new Map((observed?.columns||[]).map(c=>[c.name,c]));
  return {table,source_file:observed?.file||null,rows_observed:observed?.row_count??null,source_present:!!observed,fields:Object.entries(fields).map(([target,source])=>{const c=cols.get(source);return {target,source,column_present:!!c,has_observed_value:!!c&&Number(c.populated)>0,rows_with_value:c?.populated??null,observations:c?.present??null}})};
 });
 const covered=new Set(sources.flatMap(s=>s.fields.filter(f=>f.has_observed_value).map(f=>f.target)));
 const mapped=new Set(sources.flatMap(s=>s.fields.map(f=>f.target)));
 const required=m.fields.filter(f=>f.required);
 const missing=m.fields.filter(f=>!covered.has(f.name)).map(f=>f.name);
 return {id:m.id,name:m.name,domain:m.domain,assessment:"SOURCE_NONEMPTY_FIELD_EVIDENCE_ONLY",readiness:"NOT_ASSESSED",mapped_fields:mapped.size,observed_fields:covered.size,total_fields:m.fields.length,required_fields_without_evidence:required.filter(f=>!covered.has(f.name)).map(f=>f.name),missing_fields:missing,sources,status:covered.size?"PARTIAL_SOURCE_EVIDENCE":"NO_MAPPED_SOURCE_EVIDENCE"};
});
const report={schema_version:1,market:"kr",registry_version:registry.schema_version,snapshot_at:catalog.snapshot_at||null,generated_at:new Date().toISOString(),method:"Explicit source field aliases matched against published non-empty source columns; no SKU-level semantic validation",limitations:["Non-empty source field presence does not prove correctness, field coverage, complete SKUs, freshness, or MCP readiness","Nested or multi-purpose fields are not verified normalized business facts","Unmapped source does not prove information absent from Samsung.com","Do not calculate READY or percentage of complete marts from this report"],summary:{total_marts:results.length,with_partial_source_evidence:results.filter(x=>x.observed_fields>0).length,without_mapped_source_evidence:results.filter(x=>!x.observed_fields).length},marts:results};
const output=path.resolve(process.argv[3]||"dist/data/gaps/kr.json");await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+"\n");console.log("Gap report written",output);
