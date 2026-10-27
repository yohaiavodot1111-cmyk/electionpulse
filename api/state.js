// ElectionPulse /api/state: publicly reported turnout; no environment variable required.
// Reports attributed to the Central Elections Committee, retrieved through a news publisher.
// This is NOT a direct authenticated election-committee machine-readable feed.
const URL='https://www.zman.co.il/736805/';
const SNAPSHOTS=[{time:'10:00',percent:16.68},{time:'12:00',percent:31.5},{time:'14:00',percent:44.9}];
const KAN='https://www.kan.org.il/umbraco/surface/WhatsHappeningSurface/GetNews';
const SOURCE_14='https://www.okn.co.il/news/73351/';
const ELIGIBLE=7331981;
const CITIES=[]; // Do not display locality figures without a traceable dataset and measurement time.
function parseTurnout(html){
 const text=String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;|&zwnj;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ');
 const patterns=[
  {re:/עד\s*(?:ל)?ה?שעה\s*(\d{1,2}):00\s*הצביעו\s*(\d{1,2}(?:\.\d+)?)\s*%/g,reverse:false},
  {re:/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:מבעלי זכות הבחירה\s*)?הצביעו\s*עד\s*(?:ל)?ה?שעה\s*(\d{1,2}):00/g,reverse:true}
 ];
 const result=new Map();
 for(const {re,reverse} of patterns) for(const m of text.matchAll(re)){
   const h=Number(reverse?m[2]:m[1]),v=Number(reverse?m[1]:m[2]);
   if(h<7||h>23||v<0||v>100)continue;
   const context=text.slice(Math.max(0,m.index-80),m.index).split(/[.!?]/).at(-1)||'';
   if(/(?:בשנת|בבחירות)\s*20(?:19|20|21|22)/.test(context.slice(-35)))continue;
   const hour=String(h).padStart(2,'0')+':00';
   if(result.has(hour)&&Math.abs(result.get(hour)-v)>.1)result.set(hour,null);
   else if(!result.has(hour))result.set(hour,v);
 }
 return [...result].filter(([h,v])=>v!==null).map(([time,percent])=>({time,percent})).sort((a,b)=>a.time.localeCompare(b.time));
}
function parseKan(html) {
 const text=String(html).replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ');
 const updates=[];
 // Headline must explicitly pair the turnout measurement hour with a percentage.
 const patterns=[
  /(?:שיעור|אחוז)\s+ההצבעה[^.!?]{0,65}?עד\s*(?:ל)?(?:ה)?שעה\s*(\d{1,2}:\d{2})[^.!?]{0,50}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/g,
  /(?:שיעור|אחוז)\s+ההצבעה[^.!?]{0,65}?עד\s*(\d{1,2}:\d{2})[^.!?]{0,50}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/g
 ];
 for(const re of patterns)for(const m of text.matchAll(re)){
  const h=Number(m[1].slice(0,2)),v=Number(m[2].replace(',','.'));
  if(h>=7&&h<=23&&v>0&&v<=100)updates.push({time:m[1].padStart(5,'0'),percent:v});
 }
 return updates;
}
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const checkedAt=new Date().toISOString();
 let incoming=[],error=null,retrieved=false;
 try {
   const r=await fetch(URL,{headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 (compatible; ElectionPulse/2.0)'},signal:AbortSignal.timeout(6000),redirect:'follow',cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   if(Number(r.headers.get('content-length')||0)>3000000)throw Error('Publisher response too large');
   const html=await r.text();
   if(Buffer.byteLength(html,'utf8')>3000000)throw Error('Publisher response too large');
   incoming=parseTurnout(html);if(!incoming.length)throw Error('No eligible turnout statement found');
   retrieved=true;
 } catch(e) {error=String(e?.message||e).slice(0,180);}
 try {
   const k=await fetch(KAN,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(4500),cache:'no-store'});
   if(k.ok){const html=await k.text();if(html.length<750000){const extra=parseKan(html);incoming.push(...extra);if(extra.length)retrieved=true;}}
 } catch {} // Last verified news snapshots remain available.
 const byTime=new Map(SNAPSHOTS.map(p=>[p.time,p.percent]));
 for(const p of incoming)if(!byTime.has(p.time)||Math.abs(byTime.get(p.time)-p.percent)<=.1)byTime.set(p.time,p.percent);
 const ordered=[...byTime].sort((a,b)=>a[0].localeCompare(b[0]));
 const history=[];for(const [time,percent] of ordered)if(!history.length||percent>=history.at(-1).percent-.05)history.push({time,percent});
 const last=history.at(-1);
 const fetchedLatest=retrieved&&incoming.some(p=>p.time===last.time&&Math.abs(p.percent-last.percent)<.1);
 const updatedAt='2026-10-27T'+last.time+':00+02:00';
 res.setHeader('Cache-Control','public, s-maxage=90, stale-while-revalidate=60');
 return res.status(200).json({
   configured:true,lastCheck:checkedAt,lastSuccess:fetchedLatest?checkedAt:null,lastError:error,
   sourceHost:'news-reporters',sourceMode:fetchedLatest?'news-retrieved':'verified-news-snapshot',
   message:fetchedLatest?'Retrieved turnout as reported by publisher':'Most recent previously verified published observation; source may be inaccessible',
   data:{election:26,eligibleVoters:ELIGIBLE,totalBallots:12018,
     turnout:{percent:last.percent,voters:last.time==='14:00'?3290480:null},turnoutHistory:history,
     updatedAt,source:last.time==='14:00'?'עולם קטן – דיווח על נתוני ועדת הבחירות':'דיווח תקשורתי על נתוני ועדת הבחירות',
     sourceUrl:last.time==='14:00'?SOURCE_14:URL,sourceType:'reported',
     localityDataTime:'2026-10-27T10:00:00+02:00',
     localities:CITIES.map(c=>({...c,updatedAt:'2026-10-27T10:00:00+02:00'})),
     counted:null,parties:[],
     news:[{source:last.time==='14:00'?'עולם קטן':'דיווח תקשורתי',kind:'news',time:updatedAt,url:last.time==='14:00'?SOURCE_14:URL,title:'שיעור ההצבעה הארצי לפי דיווח: '+last.percent+'% בשעה '+last.time}]
   }
 });
}
