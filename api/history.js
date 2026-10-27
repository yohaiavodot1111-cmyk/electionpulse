// ElectionPulse historical analysis: publicly accessible, attributed election data.
// Independent archive derived from official election records; never labeled as CEC live API.
const ROOT='https://israelvoting.com/data';
const HIST=[
 {knesset:25,electionDate:'2022-11-01',eligibleVoters:6788804,voters:4794593,turnoutPct:70.63,provenance:'official'},
 {knesset:24,electionDate:'2021-03-23',eligibleVoters:6578084,voters:4436365,turnoutPct:67.44,provenance:'official'},
 {knesset:23,electionDate:'2020-03-02',eligibleVoters:6453255,voters:4615135,turnoutPct:71.52,provenance:'official'}
];
export function turnoutRow(x){
 const eligible=Number(x?.eligibleVoters),voters=Number(x?.voters);
 return {name:String(x?.name||''),code:x?.code??null,eligibleVoters:Number.isFinite(eligible)&&eligible>0?eligible:null,voters:Number.isFinite(voters)&&voters>=0?voters:null,validBallots:Number(x?.validBallots)||0,turnoutPercent:eligible>0&&Number.isFinite(voters)?+(100*voters/eligible).toFixed(3):null};
}
export function normalizeArchive(index,details,election,round){
 const metadata=(index?.turnout||HIST).filter(x=>Number.isInteger(x.knesset)&&x.knesset>=16&&x.knesset<=25).map(x=>({knesset:x.knesset,year:+(x.electionDate||'').slice(0,4),date:x.electionDate,eligibleVoters:Number(x.eligibleVoters),voters:Number(x.voters),turnoutPct:Number(x.turnoutPct),provenance:x.provenance}));
 const localities=(details?.localities||[]).map(turnoutRow).filter(x=>x.name&&x.eligibleVoters>0);
 const parties=(election?.lists||[]).filter(x=>Number.isFinite(+x.votes)).map(x=>({name:String(x.name||''),letters:String(x.ballotLetters||''),votes:+x.votes,seats:Number(x.officialSeats)||0}));
 const above=parties.filter(x=>x.seats>0).reduce((sum,x)=>sum+x.votes,0),valid=Number(election?.totalValidVotes||0);
 return {round,metadata,localities,parties,mandate:above>0?{validVotes:valid,aboveVotes:above,belowVotes:Math.max(0,valid-above),threshold:+(election.thresholdPct||3.25),baseMeter:above/120}:null,sources:[ROOT+'/turnout.json',ROOT+'/turnout/'+round+'.json',ROOT+'/elections/'+round+'.json'],external:true};
}
async function getJson(path){
 const r=await fetch(ROOT+path,{signal:AbortSignal.timeout(6200),headers:{Accept:'application/json'},cache:'no-store'});
 if(!r.ok)throw Error('Arxiv HTTP '+r.status);
 const length=Number(r.headers.get('content-length')||0);if(length>3500000)throw Error('Source file too large');
 const text=await r.text();if(text.length>3500000)throw Error('Source file too large');
 const d=JSON.parse(text);if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Unexpected archive schema');
 return d;
}
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 const round=Number(req.query?.round||25);
 if(!Number.isInteger(round)||round<21||round>25)return res.status(400).json({error:'Knesset number out of range'});
 res.setHeader('Cache-Control','public,s-maxage=1800,stale-while-revalidate=86400');
 try{
  const [index,details,election]=await Promise.all([getJson('/turnout.json'),getJson('/turnout/'+round+'.json'),getJson('/elections/'+round+'.json')]);
  const data=normalizeArchive(index,details,election,round);
  return res.status(200).json({ok:true,source:'ארכיון עצמאי המבוסס על נתונים רשמיים',retrievedAt:new Date().toISOString(),...data});
 }catch(e){
  // National historical figures remain useful when a third-party archive is offline.
  const record=HIST.find(x=>x.knesset===round);
  if(record)return res.status(200).json({ok:true,partial:true,source:'נתוני ארכיון לא זמינים – ערכים ארציים שמורים',metadata:HIST,round,localities:[],parties:[],mandate:round===25?{validVotes:4764742,aboveVotes:4347342,belowVotes:417400,threshold:3.25,baseMeter:4347342/120}:null,sources:['https://data.gov.il/he/datasets/central-election-committee/votes-knesset'],external:false,notice:'לא ניתן לאחזר פירוט לפי יישוב: '+String(e?.message||e).slice(0,95)});
  return res.status(503).json({ok:false,error:'ארכיון היישובים אינו נגיש כרגע',round,localities:[],metadata:HIST});
 }
}
