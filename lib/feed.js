// Normalize known input schemas into the ElectionPulse contract.
// Official raw exports often have a different schema: see README adapter notes.
import net from 'node:net';

export function checkedFeedUrl(value) {
  const u = new URL(value);
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443') throw Error('כתובת המקור חייבת להיות HTTPS ציבורי, ללא פרטי התחברות');
  if (host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||net.isIP(host)) throw Error('לא ניתן להשתמש בכתובת פנימית או בכתובת IP');
  if (host.length<4 || !host.includes('.')) throw Error('שם המארח של המקור אינו תקין');
  return u;
}

const num = x => (x!==null&&x!==undefined&&String(x).trim()!==''&&Number.isFinite(Number(String(x).replaceAll(',','').replace('%',''))))?Number(String(x).replaceAll(',','').replace('%','')):null;
const first=(o,keys)=>keys.map(k=>o?.[k]).find(v=>v!==undefined&&v!==null&&v!=='');

// RFC4180-compliant enough for quoted fields, embedded newlines, BOM, commas and semicolons.
export function parseCsv(input) {
  const str=String(input).replace(/^\uFEFF/,'');
  const firstLine=str.split(/\r?\n/,1)[0];
  const delimiter=firstLine.includes('\t')?'\t':firstLine.split(';').length>firstLine.split(',').length?';':',';
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<str.length;i++){
    const ch=str[i];
    if(ch==='"') { if(quoted&&str[i+1]==='"'){cell+='"';i++}else quoted=!quoted; }
    else if(ch===delimiter&&!quoted){row.push(cell.trim());cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&str[i+1]==='\n')i++;
      row.push(cell.trim());cell='';
      if(row.some(x=>x))rows.push(row);row=[];
    }else cell+=ch;
  }
  row.push(cell.trim());if(row.some(x=>x))rows.push(row);
  if(rows.length<2)throw Error('CSV אינו מכיל שורת כותרות ונתונים');
  const columns=rows.shift();
  return rows.map(r=>Object.fromEntries(columns.map((h,i)=>[h,r[i]??''])));
}

export function parseRemotePayload(text, mime='', url) {
  const looksJson=mime.toLowerCase().includes('json') || /^[\s\uFEFF]*[\[{]/.test(text) || url?.pathname.toLowerCase().endsWith('.json');
  let o;
  if (looksJson){
    try{o=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('לא ניתן לפענח JSON');}
  }else{
    const rows=parseCsv(text);
    const columns=Object.keys(rows[0]);
    if(columns.includes('time')||columns.includes('שעה')) {
      const hist=rows.map(r=>({time:String(first(r,['time','שעה'])??''),percent:num(first(r,['percent','turnoutPercent','אחוז הצבעה']))})).filter(r=>r.time&&r.percent!==null&&r.percent>=0&&r.percent<=100);
      if(!hist.length)throw Error('לא נמצאה עמודת אחוז הצבעה תקינה');
      hist.sort((a,b)=>a.time.localeCompare(b.time));
      const latest=hist[hist.length-1];
      return {election:26,turnout:{percent:latest.percent},turnoutHistory:hist,updatedAt:null};
    }
    o={election:26,localities:rows};
  }
  if(Array.isArray(o))throw Error('JSON חייב להכיל אובייקט, לא מערך');
  if(!o || typeof o!=='object')throw Error('לא נמצא אובייקט נתונים');
  if(o.data && typeof o.data==='object' && !Array.isArray(o.data))o=o.data;
  if(o.election && Number(o.election)!==26)throw Error('מקור הנתונים אינו מסומן כבחירות לכנסת ה־26');
  const counted=o.counted&&typeof o.counted==='object'?o.counted:null;
  const t=o.turnout&&typeof o.turnout==='object'?o.turnout:{};
  const eligible=num(first(o,['eligibleVoters','eligible','bzv']));
  const voters=num(first(t,['voters'])??first(o,['voters','totalVoters']));
  const reportedPct=num(first(t,['percent'])??first(o,['turnoutPercent','turnoutPct']));
  if(reportedPct!==null&&(reportedPct<0||reportedPct>100))throw Error('אחוז ההצבעה מחוץ לטווח');
  if(voters!==null&&eligible!==null&&voters>eligible)throw Error('מספר המצביעים גדול ממספר בעלי זכות הבחירה');
  let turnout=reportedPct!==null||voters!==null?{percent:reportedPct??(eligible?100*voters/eligible:null),voters:voters??(eligible!==null&&reportedPct!==null?Math.round(eligible*reportedPct/100):null)}:null;
  const locRaw=Array.isArray(o.localities)?o.localities:Array.isArray(o.cities)?o.cities:[];
  const localities=locRaw.slice(0,2500).map(r=>{
    const eligibleLocal=num(first(r,['eligibleVoters','eligible','בעלי זכות בחירה']));
    const voterLocal=num(first(r,['voters','מצביעים']));
    return {name:String(first(r,['name','city','יישוב'])??'').trim(),district:String(first(r,['district','מחוז'])??'—'),eligibleVoters:eligibleLocal,voters:voterLocal,turnoutPercent:num(first(r,['turnoutPercent','percent','אחוז הצבעה']))??(eligibleLocal>0&&voterLocal!==null?100*voterLocal/eligibleLocal:null),historicalComparablePercent:num(first(r,['historicalComparablePercent','אחוז השוואה באותה שעה'])),ballotsReported:num(first(r,['ballotsReported','קלפיות מדווחות'])),totalBallots:num(first(r,['totalBallots','סך קלפיות']))};
  }).filter(x=>x.name);
  const history=(Array.isArray(o.turnoutHistory)?o.turnoutHistory:[]).slice(0,150).map(r=>({time:String(r.time??r.updatedAt??''),percent:num(r.percent??r.turnoutPct)})).filter(r=>r.time&&r.percent!==null&&r.percent>=0&&r.percent<=100);
  const parties=(Array.isArray(o.parties)?o.parties:[]).slice(0,100).map(r=>({name:String(r.name??''),votes:num(r.votes)})).filter(r=>r.name&&r.votes!==null&&r.votes>=0);
  const news=(Array.isArray(o.news)?o.news:[]).slice(0,150).map(r=>({source:String(r.source??''),title:String(r.title??''),time:String(r.time??''),kind:String(r.kind??'news'),url:String(r.url??''),claimPercent:num(r.claimPercent),claimTime:String(r.claimTime??'')})).filter(r=>r.source&&r.title);
  if(!turnout&&!counted&&!localities.length&&!history.length&&!parties.length&&!news.length)throw Error('לא זוהה מבנה נתונים תואם; נדרש מתאם לפורמט המקור');
  return {election:26,eligibleVoters:eligible,totalBallots:num(first(o,['totalBallots','ballotsTotal'])),updatedAt:String(first(o,['updatedAt','timestamp','dataTime'])??'')||null,turnout,turnoutHistory:history,counted:counted?{ballotsReported:num(counted.ballotsReported??counted.reported),totalBallots:num(counted.totalBallots),validVotes:num(counted.validVotes),invalidVotes:num(counted.invalidVotes)}:null,localities,parties,news,sourceType:o.sourceType??null};
}
