import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRemotePayload,parseCsv,checkedFeedUrl} from '../lib/feed.js';
test('normalizes turnout JSON',()=>{
 const o=parseRemotePayload(JSON.stringify({election:26,eligibleVoters:1000,turnout:{voters:200,percent:20},updatedAt:'2026-10-27T11:00:00+02:00'}),'application/json');
 assert.equal(o.turnout.percent,20);assert.equal(o.turnout.voters,200);assert.equal(o.election,26);
});
test('normalizes hourly CSV',()=>{
 const o=parseRemotePayload('time,percent\n11:00,18.3\n13:00,30.1','text/csv');
 assert.deepEqual(o.turnout,{percent:30.1});assert.equal(o.turnoutHistory.length,2);
});
test('parses locality CSV with quoted fields',()=>{
 const o=parseRemotePayload('name,district,eligibleVoters,voters\n"תל אביב, יפו",מרכז,100,55','text/csv');
 assert.equal(o.localities[0].name,'תל אביב, יפו');assert.equal(o.localities[0].turnoutPercent,55);
});
test('rejects tests for wrong election and malformed data',()=>{
 assert.throws(()=>parseRemotePayload('{"election":25,"turnout":{"percent":70}}','application/json'),/לכנסת/);
 assert.throws(()=>parseRemotePayload('{"election":26,"turnout":{"percent":108}}','application/json'),/מחוץ/);
});
test('restricts remote URL to public HTTPS domains',()=>{
 for(const url of ['http://example.org/feed.json','https://127.0.0.1/x','https://localhost/data','https://example.local/feed']) assert.throws(()=>checkedFeedUrl(url));
 assert.equal(checkedFeedUrl('https://data.gov.il/export.json').hostname,'data.gov.il');
});
