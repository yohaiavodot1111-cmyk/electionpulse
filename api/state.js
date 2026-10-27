// ElectionPulse /api/state: publicly reported turnout; no environment variable required.
// Reports attributed to the Central Elections Committee, retrieved through a news publisher.
// This is NOT a direct authenticated election-committee machine-readable feed.
const URL='https://www.zman.co.il/736805/';
const SNAPSHOTS=[{time:'10:00',percent:16.68},{time:'12:00',percent:31.5}];
const ELIGIBLE=7331981;
const CITIES=[
  {name:'מודיעין עילית',district:'יהודה ושומרון',turnoutPercent:12.6},
  {name:'תל אביב-יפו',district:'תל אביב',turnoutPercent:9.3},
  {name:'ירושלים',district:'ירושלים',turnoutPercent:9.0},
  {name:'ראשון לציון',district:'מרכז',turnoutPercent:9.5},
  {name:'באר שבע',district:'דרום',turnoutPercent:9.5}
];
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
   sourceHost:'www.zman.co.il',sourceMode:fetchedLatest?'news-retrieved':'verified-news-snapshot',
   message:fetchedLatest?'Retrieved turnout as reported by publisher':'Most recent previously verified published observation; source may be inaccessible',
   data:{election:26,eligibleVoters:ELIGIBLE,totalBallots:12018,
     turnout:{percent:last.percent,voters:null},turnoutHistory:history,
     updatedAt,source:'זמן ישראל – דיווח על נתוני ועדת הבחירות',
     sourceUrl:URL,sourceType:'reported',
     localityDataTime:'2026-10-27T10:00:00+02:00',
     localities:CITIES.map(c=>({...c,updatedAt:'2026-10-27T10:00:00+02:00'})),
     counted:null,parties:[],
     news:[{source:'זמן ישראל',kind:'news',time:updatedAt,url:URL,title:'שיעור ההצבעה הארצי לפי דיווח: '+last.percent+'% בשעה '+last.time}]
   }
 });
}
