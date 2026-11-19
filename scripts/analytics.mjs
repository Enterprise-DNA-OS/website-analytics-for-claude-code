#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {table} from './lib/format.mjs';
import {normalize,hash,integer,text,date,cleanPath} from './lib/import-matomo.mjs';

const filters=['site','from','to'];
export const contracts={
 help:[],sites:[],visits:filters,visit:['ref'],acquisition:filters,landing:filters,pages:filters,devices:filters,countries:filters,trends:filters,journeys:filters,
 actions:['site'],attention:['site'],compliance:['site'],coverage:['site'],imports:['site'],history:[],
 'add-site':['name','source','vendor-id','owner','purpose','retention-days','access-review','privacy-review','actor'],
 'review-site':['site','access-review','privacy-review','evidence','actor'],
 'add-action':['site','title','page','owner','due','actor'],'close-action':['ref','evidence','actor'],log:['site','text','actor'],
 import:['site','file','expected-count','source-ref','from','to','actor','dry-run'],export:['file'],
 'weekly-review':['site'],'draft-brief':['site'],
};
export function parse(args){
 const verb=args[0]||'help';if(!(verb in contracts))throw Error('Unknown command: '+verb);
 const o={};const pos=[];
 for(const a of args.slice(1)){
  if(!a.startsWith('--')){pos.push(a);continue;}
  const [k,...rest]=a.slice(2).split('=');if(![...contracts[verb],'json'].includes(k))throw Error('Unknown flag: '+k);
  if(k in o)throw Error('Repeated flag: '+k);
  if(['dry-run','json'].includes(k)){if(rest.length)throw Error(k+' takes no value');o[k]=true;}
  else {if(!rest.length)throw Error(k+' needs =value');o[k]=rest.join('=');}
 }
 if(verb==='import'){if(pos.length!==1||pos[0]!=='matomo')throw Error('Use import matomo');}
 else if(pos.length)throw Error('Unexpected positional argument');
 if(('from' in o)!==('to' in o))throw Error('Supply both --from and --to');
 if(o.from){date(o.from);date(o.to);if(o.to<o.from)throw Error('Date range is reversed');}
 return {verb,o};
}
const need=(o,k)=>text(o[k],k);
const tables=['sites','imports','visits','pageviews','actions','notes','events'];
async function resolve(db,t,ref,label='name'){
 text(ref,'reference');const rows=await db.query(`SELECT * FROM ${t} WHERE id::text LIKE $1 OR lower(${label})=lower($2) ORDER BY id`,[ref+'%',ref]);
 if(rows.length!==1)throw Error((rows.length?'Ambiguous':'No matching')+' '+t+': '+JSON.stringify(rows.map(r=>({id:r.id,name:r[label]}))));return rows[0];
}
async function event(db,id,kind,actor,detail){await db.query('INSERT INTO events(entity_id,kind,actor,detail) VALUES($1,$2,$3,$4)',[id,kind,actor,JSON.stringify(detail)]);}
async function transaction(db,fn,dry=false){await db.exec('BEGIN');try{const r=await fn();await db.exec(dry?'ROLLBACK':'COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
async function read(db,verb,o){
 const site=o.site?await resolve(db,'sites',o.site):null;
 const where='($1::uuid IS NULL OR site_id=$1)';
 if(['actions','attention','compliance','coverage','imports'].includes(verb)){
  const q={actions:`SELECT site,title,owner,due,state,overdue,id,page_path FROM action_review WHERE ${where} ORDER BY due,id`,
   attention:`SELECT site,kind,detail FROM attention_review WHERE ${where} ORDER BY site,kind,detail`,
   compliance:`SELECT site,rule,finding FROM compliance_findings WHERE ${where} ORDER BY site,rule`,
   imports:`SELECT s.name site,i.* FROM imports i JOIN sites s ON s.id=i.site_id WHERE ($1::uuid IS NULL OR i.site_id=$1) ORDER BY i.created_at,i.id`,
   coverage:`SELECT s.name site,i.from_date,i.to_date,i.expected_count,i.added,i.source_ref FROM imports i JOIN sites s ON s.id=i.site_id WHERE ($1::uuid IS NULL OR i.site_id=$1) ORDER BY s.name,i.from_date,i.id`};
  return db.query(q[verb],[site?.id||null]);
 }
 const prefix=`WITH f AS (SELECT * FROM visit_facts WHERE ${where} AND ($2::date IS NULL OR started_at >= $2::date) AND ($3::date IS NULL OR started_at < $3::date+interval '1 day')) `;
 const rate="count(*)::integer visits,count(*) FILTER(WHERE converted)::integer converted_visits,round(100.0*count(*) FILTER(WHERE converted)/nullif(count(*),0),2) conversion_pct";
 const q={
  visits:'SELECT site,source_visit_id,started_at,channel,landing,reported_actions,converted,details_complete,id FROM f ORDER BY started_at,id',
  acquisition:`SELECT site,channel,${rate} FROM f GROUP BY site,channel ORDER BY site,visits DESC,channel`,
  landing:`SELECT site,landing,${rate},count(*) FILTER(WHERE reported_actions=1)::integer single_action_visits FROM f WHERE details_complete AND landing IS NOT NULL GROUP BY site,landing ORDER BY site,visits DESC,landing`,
  devices:`SELECT site,device,${rate} FROM f GROUP BY site,device ORDER BY site,visits DESC,device`,
  countries:`SELECT site,country,${rate} FROM f GROUP BY site,country ORDER BY site,visits DESC,country`,
  trends:`SELECT site,(started_at AT TIME ZONE 'UTC')::date AS visit_date,${rate} FROM f GROUP BY site,visit_date ORDER BY site,visit_date`,
  pages:`SELECT f.site,p.page_path,count(*)::integer pageviews,count(DISTINCT f.id)::integer visits,sum(p.seconds)::integer observed_seconds FROM f JOIN pageviews p ON p.visit_id=f.id GROUP BY f.site,p.page_path ORDER BY f.site,pageviews DESC,p.page_path`,
  journeys:`SELECT site,source_visit_id,converted,details_complete,(SELECT string_agg(p.page_path,' -> ' ORDER BY p.position) FROM pageviews p WHERE p.visit_id=f.id) path FROM f ORDER BY site,source_visit_id`,
 };
 return db.query(prefix+q[verb],[site?.id||null,o.from||null,o.to||null]);
}
export async function execute(db,args){
 const {verb,o}=parse(args);
 if(verb==='help')return Object.entries(contracts).map(([command,flags])=>({command,flags:flags.map(f=>'--'+f).join(' ')}));
 if(verb==='sites')return db.query('SELECT * FROM sites ORDER BY name');
 if(verb==='history')return db.query('SELECT * FROM events ORDER BY created_at,id');
 if(verb==='visit'){
  const v=await resolve(db,'visits',need(o,'ref'),'source_visit_id');
  return [{...v,pages:await db.query('SELECT position,page_path,seconds FROM pageviews WHERE visit_id=$1 ORDER BY position',[v.id])}];
 }
 if(['visits','acquisition','landing','pages','devices','countries','trends','journeys','actions','attention','compliance','coverage','imports'].includes(verb))return read(db,verb,o);
 if(verb==='add-site'){
  const actor=need(o,'actor');const vals=['name','source','vendor-id','owner','purpose'].map(k=>need(o,k));
  vals.push(integer(need(o,'retention-days'),'retention-days',1),date(need(o,'access-review')),date(need(o,'privacy-review')));
  return transaction(db,async()=>{const rows=await db.query('INSERT INTO sites(name,source_key,vendor_site_id,owner,purpose,retention_days,access_review_due,privacy_review_due) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',vals);await event(db,rows[0].id,verb,actor,{name:o.name});return rows;});
 }
 if(verb==='review-site'){
  const s=await resolve(db,'sites',need(o,'site'));const actor=need(o,'actor'),evidence=need(o,'evidence');
  return transaction(db,async()=>{const r=await db.query('UPDATE sites SET access_review_due=$1,privacy_review_due=$2 WHERE id=$3 RETURNING *',[date(need(o,'access-review')),date(need(o,'privacy-review')),s.id]);await event(db,s.id,verb,actor,{evidence});return r;});
 }
 if(verb==='add-action'){
  const s=await resolve(db,'sites',need(o,'site')),actor=need(o,'actor');
  return transaction(db,async()=>{const r=await db.query('INSERT INTO actions(site_id,title,page_path,owner,due,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[s.id,need(o,'title'),o.page?cleanPath(o.page):null,need(o,'owner'),date(need(o,'due')),actor]);await event(db,r[0].id,verb,actor,{site:s.name});return r;});
 }
 if(verb==='close-action'){
  const a=await resolve(db,'actions',need(o,'ref'),'title'),actor=need(o,'actor'),evidence=need(o,'evidence');
  return transaction(db,async()=>{const r=await db.query("UPDATE actions SET state='closed',closure_evidence=$1,closed_by=$2,closed_at=now() WHERE id=$3 AND state='open' RETURNING *",[evidence,actor,a.id]);if(!r.length)throw Error('Action already closed');await event(db,a.id,verb,actor,{evidence});return r;});
 }
 if(verb==='log'){
  const s=await resolve(db,'sites',need(o,'site')),actor=need(o,'actor');
  return transaction(db,async()=>{const r=await db.query('INSERT INTO notes(site_id,actor,body) VALUES($1,$2,$3) RETURNING *',[s.id,actor,need(o,'text')]);await event(db,s.id,verb,actor,{note_id:r[0].id});return r;});
 }
 if(verb==='import'){
  const s=await resolve(db,'sites',need(o,'site')),actor=need(o,'actor'),source_ref=need(o,'source-ref');
  date(need(o,'from'));date(need(o,'to'));const expected=integer(need(o,'expected-count'),'expected-count',1);
  const raw=JSON.parse(fs.readFileSync(need(o,'file'),'utf8').replace(/^\uFEFF/,''));if(!Array.isArray(raw)||raw.length!==expected)throw Error('Export length does not match expected-count');
  const rows=raw.map(v=>normalize(v,s));if(new Set(rows.map(v=>v.source_visit_id)).size!==rows.length)throw Error('Duplicate visit ID in export');
  for(const v of rows)if(v.started_at.slice(0,10)<o.from||v.started_at.slice(0,10)>o.to)throw Error('Visit outside declared UTC date range');
  const fingerprint=hash({from:o.from,to:o.to,rows:[...rows].sort((a,b)=>a.source_visit_id.localeCompare(b.source_visit_id))});
  return transaction(db,async()=>{
   // One site import at a time on Postgres; PGlite already serialises this connection.
   await db.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE',[s.id]);
   const existing=await db.query('SELECT source_visit_id,record_hash FROM visits WHERE site_id=$1',[s.id]);const byId=new Map(existing.map(v=>[v.source_visit_id,v.record_hash]));
   for(const v of rows)if(byId.has(v.source_visit_id)&&byId.get(v.source_visit_id)!==hash(v))throw Error('Conflicting visit '+v.source_visit_id+': export closed visits only; retain corrections separately');
   const add=rows.filter(v=>!byId.has(v.source_visit_id));
   let imp=(await db.query('SELECT * FROM imports WHERE site_id=$1 AND fingerprint=$2',[s.id,fingerprint]))[0];
   if(!imp){[imp]=await db.query('INSERT INTO imports(site_id,fingerprint,source_ref,expected_count,added,actor,from_date,to_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[s.id,fingerprint,source_ref,expected,add.length,actor,o.from,o.to]);
    for(const v of add){const [r]=await db.query('INSERT INTO visits(site_id,import_id,source_visit_id,started_at,channel,referrer,device,country,reported_actions,detail_count,converted,duration_seconds,record_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id',[s.id,imp.id,v.source_visit_id,v.started_at,v.channel,v.referrer,v.device,v.country,v.reported_actions,v.detail_count,v.converted,v.duration_seconds,hash(v)]);for(const p of v.pages)await db.query('INSERT INTO pageviews(visit_id,position,page_path,seconds) VALUES($1,$2,$3,$4)',[r.id,p.position,p.page_path,p.seconds]);}
    await event(db,imp.id,'import',actor,{site:s.name,added:add.length,source_ref});
   }
   return [{site:s.name,added:add.length,unchanged:rows.length-add.length,incomplete:rows.filter(v=>v.detail_count<v.reported_actions).length,dry_run:!!o['dry-run']}];
  },!!o['dry-run']);
 }
 if(verb==='export'){
  const file=path.resolve(need(o,'file'));const records=await transaction(db,async()=>{const out={};for(const t of tables)out[t]=await db.query('SELECT * FROM '+t+' ORDER BY id');return out;});
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,JSON.stringify({format:'website-analytics-v1',created:new Date().toISOString(),records},null,2)+'\n',{flag:'wx',mode:0o600});return [{file,record_types:tables.length}];
 }
 if(['weekly-review','draft-brief'].includes(verb)){
  const s=await resolve(db,'sites',need(o,'site'));const sections={};for(const k of ['acquisition','landing','attention','coverage'])sections[k]=await read(db,k,{site:s.id});
  const dir=path.join(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,verb+'-'+Date.now()+'-'+s.id+'.md');
  fs.writeFileSync(file,'# '+s.name+' website review\n\nDraft. Loaded history only. UTC dates. Review export coverage before comparing periods.\n\n'+Object.entries(sections).map(([k,r])=>'## '+k+'\n\n'+format(r)).join('\n\n')+'\n',{flag:'wx',mode:0o600});return [{file}];
 }
 throw Error('Unhandled command');
}
export function format(rows){return table(rows,rows.length?Object.keys(rows[0]).map(key=>({key,label:key,format:v=>typeof v==='object'&&v!==null?JSON.stringify(v):v})):[]);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{const args=process.argv.slice(2);const {o}=parse(args);db=await getDb();const r=await execute(db,args);console.log(o.json?JSON.stringify(r,null,2):format(r));}catch(e){console.error(e.message);process.exitCode=1;}finally{await db?.close();}
}
