// Public election turnout monitor. Never labels news headlines as the official election API.
// No dependency on zman.co.il (HTTP 403 from serverless runtimes).
const ELIGIBLE=7331981;
const BALLOTS=12018;
const DAY='2026-10-27';
const KAN='https://www.kan.org.il/umbraco/surface/WhatsHappeningSurface/GetNews';
const YNET='https://www.ynet.co.il/Integration/StoryRss1854.xml';
const TOI='https://www.timesofisrael.com/feed/?post_type=liveblog_entry';
const RSS='https://news.google.com/rss/search?q='+encodeURIComponent('אחוז הצבעה בחירות 2026 ועדת הבחירות')+'&hl=he&gl=IL&ceid=IL:he';
const KNOWN=[
  {time:'10:00',percent:16.68,voters:null,source:'i24NEWS – דיווח ועדת הבחירות',url:'https://www.i24news.tv/he/news/israel-elections-2026/artc-f95249f2'},
  {time:'12:00',percent:31.5,voters:2309587,source:'גלובס – דיווח ועדת הבחירות',url:'https://en.globes.co.il/news/article.aspx?did=1001560922'},
  {time:'14:00',percent:44.9,voters:3290480,source:'עולם קטן – דיווח ועדת הבחירות',url:'https://www.okn.co.il/news/73351/'},
  {time:'16:00',percent:55.7,voters:4085075,source:'ynet – נתוני ועדת הבחירות',url:'https://www.ynet.co.il/news/article/sypynnr2zx'}
];
function decode(s){
 return String(s||'').replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Number(v))).replace(/&#x([a-f0-9]+);/gi,(_,v)=>String.fromCodePoint(parseInt(v,16))).replace(/&nbsp;|&zwnj;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function tidy(s){return decode(String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();}
function extractEnglish(line){
 const s=tidy(line).toLowerCase();
 if(!/(?:voter\s+)?turnout|voters?\s+cast|cast\s+(?:their\s+)?ballots/.test(s))return null;
 if(/soldiers|idf|military|2022|2021|2020|arab\s+(?:voters?|turnout)|in\s+(?:jerusalem|tel\s+aviv|haifa|rahat|modiin)/.test(s))return null;
 const hourOf=(hour,meridiem)=>{
   let h=Number(hour);
   const ampm=(meridiem||'').toLowerCase().replace(/\./g,'');
   if(ampm==='pm'&&h<12)h+=12;
   if(ampm==='am'&&h===12)h=0;
   return h;
 };
 const patterns=[
  /(?:voter\s+)?turnout[^\n]{0,45}?at\s+(\d{1,2}(?:[.,]\d{1,2})?)%[^\n]{0,55}?(?:as\s+of|by)\s+(\d{1,2})(?::00)?\s*(a\.?m\.?|p\.?m\.?)?/i,
  /(\d{1,2}(?:[.,]\d{1,2})?)%[^\n]{0,55}?(?:as\s+of|by)\s+(\d{1,2})(?::00)?\s*(a\.?m\.?|p\.?m\.?)?/i,
  /(?:as\s+of|by)\s+(\d{1,2})(?::00)?\s*(a\.?m\.?|p\.?m\.?)?[^\n]{0,65}?(\d{1,2}(?:[.,]\d{1,2})?)%/i
 ];
 for(let i=0;i<patterns.length;i++){
  const m=s.match(patterns[i]);if(!m)continue;
  const h=hourOf(i<2?m[2]:m[1],i<2?m[3]:m[2]),v=Number((i<2?m[1]:m[3]).replace(',','.'));
  if(h>=7&&h<=22&&h%2===0&&v>0&&v<=100)return {time:String(h).padStart(2,'0')+':00',percent:v};
 }
 return null;
}
function extract(line){
 const s=tidy(line);
 if(!/(?:אחוז|שיעור|אחוזי)\s*(?:ה)?הצבעה|(?:\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:מבעלי\s+זכות\s+הבחירה\s*)?הצביעו\s*עד/.test(s))return null;
 if(/צה"ל|בצבא|חיילים|2022|2021|2020/.test(s))return null;
 const patterns=[
  {p:/(?:עד|נכון)\s*(?:ל)?(?:ה)?שעה\s*(\d{1,2})(?::(\d{2}))?\s*[-:–־]?\s*(?:עמד(?:ה)?\s*על\s*)?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/,reverse:false},
  {p:/(?:אחוז|שיעור|אחוזי)\s*(?:ה)?הצבעה[^.!?]{0,55}?(?:עד|נכון)\s*(?:ל)?(?:ה)?שעה\s*(\d{1,2})(?::(\d{2}))?[^%.]{0,55}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/,reverse:false},
  {p:/(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:מבעלי זכות הבחירה\s*)?(?:הצביעו|השתתפו)?[^.!?]{0,40}?(?:עד|נכון)\s*(?:ל)?(?:ה)?שעה\s*(\d{1,2})(?::(\d{2}))?/,reverse:true},
  {p:/(\d{1,2}):(\d{2})\s*[-:–־]?\s*(?:שיעור|אחוז|אחוזי)\s*(?:ה)?הצבעה[^.!?]{0,45}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/,reverse:false},
  {p:/(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:מבעלי\s+זכות\s+הבחירה\s*)?הצביעו\s*עד\s*(?:ל)?(?:ה)?שעה\s*(\d{1,2})(?::(\d{2}))?/,reverse:true}
 ];
 for(const {p,reverse} of patterns){
  const m=s.match(p);if(!m)continue;
  const hour=Number(reverse?m[2]:m[1]),min=Number((reverse?m[3]:m[2])||0),percent=Number((reverse?m[1]:m[3]).replace(',','.'));
  if(hour<7||hour>23||min!==0||percent<1||percent>100)continue;
  return {time:String(hour).padStart(2,'0')+':00',percent};
 }
 return null;
}
async function fetchText(url,timeout=3000){
 const r=await fetch(url,{headers:{Accept:'text/html, application/xml, application/rss+xml'},signal:AbortSignal.timeout(timeout),cache:'no-store'});
 if(!r.ok)throw Error('HTTP '+r.status);
 if(Number(r.headers.get('content-length')||0)>500000)throw Error('Response too large');
 const t=await r.text();if(t.length>500000)throw Error('Response too large');return t;
}
async function fromKan(){
 const txt=await fetchText(KAN);
 return txt.split(/<\/(?:li|article|a|h[1-6])>/gi).map(x=>extract(x.slice(-650))).filter(Boolean).map(x=>({...x,source:'כאן חדשות – דיווח ההשתתפות',url:KAN}));
}
function rssRecords(xml,source,sourceUrl,english=false){
 const out=[];
 for(const [,item] of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
   const pub=(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)||[])[1],date=new Date(pub);
   if(!Number.isFinite(date.getTime()))continue;
   const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
   if(day!==DAY)continue;
   const title=(item.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]||'';
   const report=(english?extractEnglish(title):extract(title));
   if(!report)continue;
   const href=decode((item.match(/<link>([^<]+)<\/link>/i)||[])[1]||sourceUrl);
   out.push({...report,source,url:href.startsWith('https://')?href:sourceUrl});
 }
 return out;
}
async function fromYnet(){
 return rssRecords(await fetchText(YNET,4500),'ynet – דיווח השתתפות',YNET,false);
}
async function fromToi(){
 return rssRecords(await fetchText(TOI,4500),'The Times of Israel – turnout',TOI,true);
}
async function fromRss(){
 const xml=await fetchText(RSS);
 const out=[];
 for(const [,item] of xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)){
  const published=(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)||[])[1],date=new Date(published);
  if(!Number.isFinite(date.getTime()))continue;
  const dateIL=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  if(dateIL!==DAY)continue;
  const headline=(item.match(/<title>([\s\S]*?)<\/title>/)||[])[1]||'';
  const report=extract(headline);if(!report)continue;
  const url=decode((item.match(/<link>([^<]+)<\/link>/)||[])[1]||RSS);
  out.push({...report,source:'דיווח ב־Google News',url:url.startsWith('https://')?url:RSS});
 }
 return out;
}
function combine(reports){
 const data=new Map(KNOWN.map(x=>[x.time,{...x,kind:'snapshot'}]));
 for(const x of reports){
  const existing=data.get(x.time);
  if(existing&&Math.abs(existing.percent-x.percent)>.11)continue;
  if(!existing)data.set(x.time,{...x,voters:null,kind:'retrieved'});
 }
 let previous=-1;
 return [...data.values()].sort((a,b)=>a.time.localeCompare(b.time)).filter(x=>{if(x.percent+0.05<previous)return false;previous=x.percent;return true});
}
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const checkedAt=new Date().toISOString();
 const results=await Promise.allSettled([fromKan(),fromRss(),fromYnet(),fromToi()]);
 const live=results.flatMap(r=>r.status==='fulfilled'?r.value:[]);
 const history=combine(live),last=history.at(-1);
 const fresh=live.some(x=>x.time===last.time&&Math.abs(x.percent-last.percent)<.11);
 const updatedAt=DAY+'T'+last.time+':00+02:00';
 res.setHeader('Cache-Control','public,s-maxage=45,stale-while-revalidate=60');
 return res.status(200).json({
  configured:true,lastCheck:checkedAt,lastSuccess:fresh?checkedAt:null,lastError:null,
  sourceHost:null,sourceMode:fresh?'news-retrieved':'verified-news-snapshot',
  sourceDiagnostics:results.map((x,i)=>({source:['kan','google-news','ynet','times-of-israel'][i],available:x.status==='fulfilled',count:x.status==='fulfilled'?x.value.length:0})),
  message:fresh?'נקלט דיווח תקשורתי חדש':'הדיווח האחרון שתועד, ללא אישור לעדכון חי נוסף',
  data:{
   election:26,eligibleVoters:ELIGIBLE,totalBallots:BALLOTS,
   turnout:{percent:last.percent,voters:last.voters},
   turnoutHistory:history.map(x=>({time:x.time,percent:x.percent})),
   updatedAt,source:last.source,sourceUrl:last.url,sourceType:'reported',
   localities:[],counted:null,parties:[],
   news:[{source:last.source,kind:'news',time:updatedAt,url:last.url,title:'שיעור ההשתתפות '+last.percent+'% נכון לשעה '+last.time}]
  }
 });
}
