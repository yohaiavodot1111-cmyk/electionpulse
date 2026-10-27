// Vercel Serverless Function — GET /api/state.
// No public URL setter: the operator configures ELECTION_FEED_URL in Vercel.
// A remote feed's existence does not by itself prove that it is official.
import { parseRemotePayload, checkedFeedUrl } from '../lib/feed.js';

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'GET') return res.status(405).json({error: 'Method not allowed'});
  const checkedAt = new Date().toISOString();
  const rawUrl = process.env.ELECTION_FEED_URL?.trim();
  if (!rawUrl) {
    res.setHeader('Cache-Control','public, s-maxage=30');
    return res.status(200).json({data:null,configured:false,lastCheck:checkedAt,lastError:null,sourceHost:null,message:'לא הוגדר ELECTION_FEED_URL במשתני הסביבה של Vercel'});
  }
  let feedUrl;
  try { feedUrl = checkedFeedUrl(rawUrl); }
  catch (err) { return res.status(200).json({data:null,configured:true,lastCheck:checkedAt,lastError:err.message,sourceHost:null}); }
  try {
    const response=await fetch(feedUrl.toString(),{
      method:'GET',headers:{'Accept':'application/json,text/csv,text/plain;q=0.8','User-Agent':'ElectionPulse/1.0 (election analytics dashboard)'},
      redirect:'error', signal:AbortSignal.timeout(7500), cache:'no-store'
    });
    if (!response.ok) throw new Error('המקור השיב HTTP '+response.status);
    const reportedSize=Number(response.headers.get('content-length')||0);
    if (reportedSize>4_000_000) throw new Error('קובץ המקור גדול מהמגבלה (4MB)');
    const text=await response.text();
    if (Buffer.byteLength(text,'utf8')>4_000_000) throw new Error('קובץ המקור גדול מהמגבלה (4MB)');
    const payload=parseRemotePayload(text,response.headers.get('content-type')||'',feedUrl);
    // Keep test feeds explicitly flagged even if they contain turnout numbers.
    const isTest = ['test','demo','simulation'].includes(String(process.env.ELECTION_FEED_KIND||'').toLowerCase()) || ['demo','test'].includes(String(payload.sourceType||'').toLowerCase());
    const data={...payload,election:26,source:`https://${feedUrl.hostname}`,sourceType:isTest?'demo':'auto'};
    res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=30');
    return res.status(200).json({data,configured:true,lastCheck:checkedAt,lastSuccess:checkedAt,lastError:null,sourceHost:feedUrl.hostname,feedKind:isTest?'test':'external'});
  } catch (err) {
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({data:null,configured:true,lastCheck:checkedAt,lastError:String(err?.message||err).slice(0,220),sourceHost:feedUrl.hostname});
  }
}
