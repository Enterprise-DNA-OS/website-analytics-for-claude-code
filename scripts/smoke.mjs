import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {execute,contracts,parse} from './analytics.mjs';
import {normalize,cleanPath} from './lib/import-matomo.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'website-analytics-'));
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';process.env.DATA_DIR=path.join(tmp,'db');process.env.OUTPUT_DIR=tmp;
let db=await getDb();const seen=new Set();const run=(v,...args)=>{seen.add(v);return execute(db,[v,...args]);};
const studio='--site=Fictional Studio';
const sample=path.join(REPO_ROOT,'examples/matomo-visits.json');const original=JSON.parse(fs.readFileSync(sample));
const base=['matomo','--site=Fictional Academy','--file='+sample,'--expected-count=10','--from=2025-01-01','--to=2026-11-16','--source-ref=Fictional independently counted list','--actor=Test operator'];
const badfile=(name,rows)=>{const f=path.join(tmp,name+'.json');fs.writeFileSync(f,JSON.stringify(rows));return base.map(a=>a.startsWith('--file=')?'--file='+f:a);};
try{
 if(process.env.TEST_DATABASE_URL)assert.equal((await db.query("SELECT * FROM pg_tables WHERE schemaname='public'")).length,0,'Use an empty disposable database');
 await migrate(db);assert.equal((await migrate(db)).ran.length,0);await seed(db);await seed(db);
 assert.equal((await run('sites')).length,2);assert.equal((await run('visits')).length,10);
 const a=await run('acquisition',studio);assert.equal(a.find(x=>x.channel==='search').visits,4);assert.equal(Number(a.find(x=>x.channel==='search').conversion_pct),50);
 const land=await run('landing',studio);assert.equal(land.reduce((s,x)=>s+x.visits,0),9,'Incomplete visit is excluded');assert.equal(land.find(x=>x.landing.endsWith('/services')).converted_visits,2);
 const pages=await run('pages',studio);assert.equal(pages.reduce((s,x)=>s+x.pageviews,0),14);assert.ok(pages.every(x=>!x.page_path.includes('?')));
 assert.equal((await run('acquisition',studio,'--from=2026-11-16','--to=2026-11-16')).reduce((s,x)=>s+x.visits,0),3);
 for(const v of ['devices','countries','trends','journeys','actions','attention','compliance','coverage','imports','history','help'])await run(v,...(contracts[v].includes('site')?[studio]:[]));
 assert.ok((await run('compliance',studio)).some(x=>x.rule==='retention-review'));
 const [visit]=await run('visit','--ref=101');assert.equal(visit.pages.length,2);
 await assert.rejects(()=>db.query("UPDATE visits SET channel='changed' WHERE id=$1",[visit.id]),/append-only/);
 assert.equal((await run('import',...base,'--dry-run'))[0].added,10);assert.equal((await run('visits')).length,10);
 assert.equal((await run('import',...base))[0].added,10);assert.equal((await run('import',...base))[0].added,0);assert.equal((await run('visits')).length,20);
 await assert.rejects(()=>run('visit','--ref=101'),/Ambiguous/);assert.equal((await run('visit','--ref='+visit.id))[0].id,visit.id);
 const changed=structuredClone(original);changed[0].visitConverted=0;await assert.rejects(()=>run('import',...badfile('conflict',changed)),/Conflicting/);
 const wrong=structuredClone(original);wrong[9].idSite=99;await assert.rejects(()=>run('import',...badfile('wrong-site',wrong)),/different idSite/);
 const duplicate=structuredClone(original);duplicate[9]=duplicate[0];await assert.rejects(()=>run('import',...badfile('duplicate',duplicate)),/Duplicate/);
 await assert.rejects(()=>run('import',...base.map(a=>a==='--expected-count=10'?'--expected-count=9':a)),/does not match/);
 await assert.rejects(()=>run('import',...base.map(a=>a==='--from=2025-01-01'?'--from=2026-01-01':a)),/outside declared/);
 const privacy=structuredClone(original[0]);privacy.visitIp='192.0.2.1';privacy.visitorId='secret visitor';privacy.userId='private@example.test';privacy.actionDetails[0].url='https://demo.example/services?email=private@example.test#fragment';privacy.actionDetails[0].pageTitle='Private name';
 const norm=JSON.stringify(normalize(privacy,{vendor_site_id:'1'}));for(const secret of ['192.0.2.1','secret visitor','private@example','Private name','fragment'])assert.ok(!norm.includes(secret));
 assert.throws(()=>normalize({...original[0],visitConverted:2},{vendor_site_id:'1'}),/0 or 1/);
 assert.throws(()=>cleanPath('javascript:alert(1)'),/HTTP/);
 assert.throws(()=>parse(['acquisition','--from=2026-02-30','--to=2026-03-01']),/real YYYY/);
 for(const args of [['visits','--typo'],['visits','junk'],['help','--json=false'],['visits','--from=2026-01-01']])assert.throws(()=>parse(args));
 const [site]=await run('add-site','--name=New site','--source=New instance','--vendor-id=1','--owner=Test owner','--purpose=Testing','--retention-days=30','--access-review=2027-01-01','--privacy-review=2027-01-01','--actor=Test operator');
 await run('review-site','--site='+site.id.slice(0,12),'--access-review=2027-02-01','--privacy-review=2027-02-01','--evidence=Recorded review','--actor=Test operator');
 const [action]=await run('add-action',studio,'--title=Check <script>alert(1)</script>','--page=https://demo.example/services?ignore=yes','--owner=Test owner','--due=2026-11-01','--actor=Test operator');
 await assert.rejects(()=>run('close-action','--ref='+action.id,'--evidence=','--actor=Test operator'),/nonempty/);
 await run('close-action','--ref='+action.id,'--evidence=Observed result reviewed','--actor=Test operator');
 await assert.rejects(()=>run('close-action','--ref='+action.id,'--evidence=Second close','--actor=Test operator'),/already closed/);
 await run('log',studio,'--text=Review <b>mobile</b> results','--actor=Test operator');
 for(const v of ['weekly-review','draft-brief']){const [r]=await run(v,studio);assert.match(fs.readFileSync(r.file,'utf8'),/Draft\./);}
 const file=path.join(tmp,'backup.json');await run('export','--file='+file);assert.equal(Object.keys(JSON.parse(fs.readFileSync(file)).records).length,7);await assert.rejects(()=>run('export','--file='+file),/EEXIST/);
 // Validation failure after a valid first row must not leave any imported visits.
 const before=(await run('visits')).length;const bad=structuredClone(original);bad[0].idVisit=999;bad[9].actions=-1;await assert.rejects(()=>run('import',...badfile('invalid-last-row',bad)),/integer/);assert.equal((await run('visits')).length,before);
 await db.close();db=null;
 for(const name of ['view','docs']){const p=spawnSync(process.execPath,['scripts/'+name+'.mjs'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(p.status,0,p.stderr);}
 const docs=path.join(tmp,'docs-out','website-review');const html=fs.readdirSync(docs).map(f=>fs.readFileSync(path.join(docs,f),'utf8')).join('');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert'));
 for(const json of [false,true]){const p=spawnSync(process.execPath,['scripts/analytics.mjs','acquisition',studio,...(json?['--json']:[])],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(p.status,0,p.stderr);if(json)assert.equal(JSON.parse(p.stdout).length,4);else assert.match(p.stdout,/conversion_pct/);}
 const ambiguous=spawnSync(process.execPath,['scripts/analytics.mjs','visit','--ref=101'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(ambiguous.status,1);assert.match(ambiguous.stderr,/Ambiguous/);
 assert.deepEqual(Object.keys(contracts).filter(k=>!seen.has(k)),[]);
 console.log(`PASS: ${seen.size} CLI verbs; metric denominators, incomplete histories, source isolation, import idempotency, validation, privacy minimisation, evidence controls, drafts, exports and escaped reports`);
}finally{await db?.close();fs.rmSync(tmp,{recursive:true,force:true});}
