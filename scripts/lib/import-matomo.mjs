import crypto from 'node:crypto';
export const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function integer(x,name,min=0){
 if(!/^[0-9]+$/.test(String(x))||!Number.isSafeInteger(Number(x))||Number(x)<min)throw Error(name+' must be an integer >= '+min);
 return Number(x);
}
export function text(x,name){if(typeof x!=='string'||!x.trim()||x.length>2000)throw Error(name+' must be nonempty text (up to 2000 characters)');return x.trim();}
export function date(x){if(!/^\d{4}-\d{2}-\d{2}$/.test(x)||!Number.isFinite(Date.parse(x))||new Date(x).toISOString().slice(0,10)!==x)throw Error('Expected a real YYYY-MM-DD date');return x;}
export function cleanPath(raw){
 const u=new URL(raw);if(!['http:','https:'].includes(u.protocol))throw Error('Page URL must use HTTP or HTTPS');
 return u.origin+u.pathname; // Never persist query strings, fragments, credentials or page titles.
}
export function normalize(v,site){
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Expected a Matomo visit object');
 if(String(v.idSite)!==site.vendor_site_id)throw Error('Export contains a different idSite');
 const id=String(integer(v.idVisit,'idVisit',1));
 const seconds=integer(v.firstActionTimestamp,'firstActionTimestamp',1);
 if(seconds>253402300799)throw Error('Visit timestamp is outside supported range');
 const started_at=new Date(seconds*1000).toISOString();
 const converted=integer(v.visitConverted,'visitConverted');if(converted>1)throw Error('visitConverted must be 0 or 1');
 if(!Array.isArray(v.actionDetails))throw Error('actionDetails must be an array');
 const reported_actions=integer(v.actions,'actions');
 const pages=v.actionDetails.flatMap((a,i)=>{
  if(!a||typeof a.type!=='string')throw Error('Every action needs a type');
  return a.type==='action'?[{position:i+1,page_path:cleanPath(a.url),seconds:integer(a.timeSpent??0,'timeSpent')}]:[];
 });
 return {source_visit_id:id,started_at,channel:text(v.referrerType,'referrerType'),referrer:String(v.referrerName||'Direct').slice(0,200),device:String(v.deviceType||'Unknown').slice(0,100),country:String(v.countryCode||'unknown').slice(0,10),reported_actions,detail_count:v.actionDetails.length,converted:converted===1,duration_seconds:integer(v.visitDuration,'visitDuration'),pages};
}
