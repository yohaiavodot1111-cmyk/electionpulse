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

test('API without configured URL explicitly returns no live data',async()=>{
  const orig=process.env.ELECTION_FEED_URL;
  delete process.env.ELECTION_FEED_URL;
  try {
    const res=mockRes();await handler({method:'GET'},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.value.configured,false);
    assert.equal(res.value.data,null);
  } finally { if(orig!==undefined)process.env.ELECTION_FEED_URL=orig; }
});

test('API is read-only', async()=>{
  const res=mockRes();await handler({method:'POST'},res);
  assert.equal(res.statusCode,405);
});
