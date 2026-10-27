import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeArchive,turnoutRow} from '../api/history.js';
import {rssToMedia} from '../api/media.js';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

test('national archive per-mandate quotient and turnout share',()=>{
 const data=normalizeArchive(
  {turnout:[{knesset:25,electionDate:'2022-11-01',eligibleVoters:6788804,voters:4794593,turnoutPct:70.63,provenance:'official'}]},
  {localities:[{name:'אשקלון',code:7100,eligibleVoters:100000,voters:71000,validBallots:70900}]},
  {totalValidVotes:4764742,thresholdPct:3.25,lists:[{name:'רשימה א',votes:4347342,officialSeats:120},{name:'רשימה ב',votes:417400,officialSeats:0}]},25
 );
 assert.equal(data.localities[0].turnoutPercent,71);
 assert.equal(data.mandate.baseMeter,36227.85);
 assert.equal(data.mandate.belowVotes,417400);
 assert.equal(data.metadata[0].knesset,25);
});
test('missing locality denominator never synthesizes turnout',()=>{
 assert.equal(turnoutRow({name:'יישוב',voters:50}).turnoutPercent,null);
});
test('media RSS ignores entries missing links',()=>{
 const xml='<rss><item><title><![CDATA[בחירות 2026 – עדכון]]></title><link>https://news.google.com/a</link><pubDate>Tue, 27 Oct 2026 15:00:00 GMT</pubDate></item><item><title>אין קישור</title></item></rss>';
 const news=rssToMedia(xml);assert.equal(news.length,1);assert.match(news[0].title,/בחירות/);
});
test('dashboard inline JavaScript parses without syntax errors and contains calculator controls',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const m=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(m,'inline dashboard script exists');
 assert.doesNotThrow(()=>new Script(m[1],{filename:'index.html'}));
 for(const id of ['mandateControls','validVoteRate','qualifiedVoteRate','currentAnalytics','mandateMethod'])assert.ok(html.includes('id="'+id+'"'),'missing '+id);
});
