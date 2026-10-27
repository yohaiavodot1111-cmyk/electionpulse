// Read-only, public news discovery via RSS. No social network impersonation.
const RSS='https://news.google.com/rss/search?q='+encodeURIComponent('בחירות לכנסת 26 אחוז ההצבעה תוצאות when:1d')+'&hl=he&gl=IL&ceid=IL:he';
const decode=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(?:amp|lt|gt|quot|apos|#39|#x27);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'"}[m]||m));
const val=(s,tag)=>{const m=String(s).match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));return m?decode(m[1].trim()):''};
export function rssToMedia(xml){
 const items=String(xml).match(/<item\b[^>]*>[\s\S]*?<\/item>/gi)||[];
 return items.slice(0,20).map(item=>({title:val(item,'title').replace(/<[^>]+>/g,'').slice(0,280),source:val(item,'source')||'Google News',time:val(item,'pubDate'),kind:'news',url:val(item,'link'),claimPercent:null,claimTime:''})).filter(x=>x.title&&/^https:\/\//.test(x.url));
}
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 res.setHeader('Cache-Control','public,s-maxage=300,stale-while-revalidate=600');
 try{
  const r=await fetch(RSS,{signal:AbortSignal.timeout(5500),headers:{Accept:'application/rss+xml,application/xml,text/xml'}});
  if(!r.ok)throw Error('RSS '+r.status);
  const xml=await r.text();if(xml.length>700000)throw Error('Source too large');
  return res.status(200).json({ok:true,items:rssToMedia(xml),source:'Google News RSS',checkedAt:new Date().toISOString(),notice:'כותרות חדשות בלבד, טענות לא אומתו בנפרד'});
 }catch(e){
  return res.status(200).json({ok:false,items:[],source:'Google News RSS',notice:'מקור חדשות לא זמין כרגע'});
 }
}
