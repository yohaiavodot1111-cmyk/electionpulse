import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/state.js';

function mockRes(){
 return {headers:{},statusCode:200,value:null,setHeader(k,v){this.headers[k]=v},status(v){this.statusCode=v;return this},json(v){this.value=v;return this}};
}
test('Blocked publishers do not break the latest documented report',async()=>{
 const initial=globalThis.fetch;globalThis.fetch=async()=>{throw Error('HTTP 403 blocked')};
 try{
  const res=mockRes();await handler({method:'GET'},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.value.configured,true);
  assert.equal(res.value.lastError,null);
  assert.equal(res.value.data.sourceType,'reported');
  assert.equal(res.value.data.turnout.percent,55.7);
  assert.equal(res.value.data.updatedAt,'2026-10-27T16:00:00+02:00');
  assert.equal(res.value.sourceMode,'verified-news-snapshot');
  assert.equal(res.value.data.turnout.voters,null);
 }finally{globalThis.fetch=initial}
});
test('Newer report is read when a valid next hourly bulletin appears',async()=>{
 const initial=globalThis.fetch;
 globalThis.fetch=async(url)=>({ok:true,headers:new Headers({'content-length':'500'}),text:async()=>String(url).includes('kan.org.il')?'<li>שיעור ההצבעה עד לשעה 18:00 - 65.2%</li>':'<rss><channel></channel></rss>'});
 try{
  const res=mockRes();await handler({method:'GET'},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.value.data.turnout.percent,65.2);
  assert.equal(res.value.data.updatedAt,'2026-10-27T18:00:00+02:00');
  assert.equal(res.value.sourceMode,'news-retrieved');
 }finally{globalThis.fetch=initial}
});
test('Conflicting reports are not allowed to rewrite historical measurements',async()=>{
 const initial=globalThis.fetch;
 globalThis.fetch=async(url)=>({ok:true,headers:new Headers({'content-length':'500'}),text:async()=>String(url).includes('kan.org.il')?'<li>שיעור ההצבעה עד לשעה 16:00 - 54.1%</li>':'<rss><channel></channel></rss>'});
 try{
  const res=mockRes();await handler({method:'GET'},res);
  assert.equal(res.value.data.turnout.percent,55.7);
  assert.equal(res.value.data.turnoutHistory.at(-1).percent,55.7);
 }finally{globalThis.fetch=initial}
});
test('API is read-only',async()=>{
 const res=mockRes();await handler({method:'POST'},res);assert.equal(res.statusCode,405);
});
