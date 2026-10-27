import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/state.js';

function mockRes(){
  return {
    headers:{}, statusCode:200, value:null,
    setHeader(k,v){this.headers[k]=v},
    status(v){this.statusCode=v;return this},
    json(v){this.value=v;return this},
  };
}

test('reported turnout is served without manual API configuration',async()=>{
  const priorFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('source temporarily unavailable')};
  try{
    const res=mockRes();await handler({method:'GET'},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.value.configured,true);
    assert.equal(res.value.data.sourceType,'reported');
    assert.equal(res.value.data.turnout.percent,44.9);
    assert.equal(res.value.data.turnout.voters,3290480);
    assert.equal(res.value.data.updatedAt,'2026-10-27T14:00:00+02:00');
    assert.equal(res.value.sourceMode,'verified-news-snapshot');
    assert.equal(res.value.lastError,null);
  }finally{globalThis.fetch=priorFetch}
});

test('public news feed adds later turnout reports when detected',async()=>{
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(url)=>({ok:true,headers:new Headers({'content-length':'100'}),text:async()=>String(url).includes('kan.org.il')?'שיעור ההצבעה עד לשעה 16:00 - 55.2%':'אין דיווחי השתתפות בכתבה הזו'});
 try{
   const res=mockRes();await handler({method:'GET'},res);
   assert.equal(res.value.data.turnout.percent,55.2);
   assert.equal(res.value.data.updatedAt,'2026-10-27T16:00:00+02:00');
   assert.equal(res.value.sourceMode,'news-retrieved');
 }finally{globalThis.fetch=originalFetch}
});

test('API remains read-only',async()=>{
  const res=mockRes();await handler({method:'POST'},res);
  assert.equal(res.statusCode,405);
});