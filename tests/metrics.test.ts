import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachePercent, contextReading, duration, total, fold, speed, compact, reading, mergeReading, sumUsage, observeOutput, timingSample, restoreTiming } from '../src/metrics.js';
const tokens = {input:100,output:60,reasoning:40,cache:{read:300,write:100}};
test('disjoint input buckets and reasoning are counted once',()=>{assert.equal(total(tokens),600);assert.equal(cachePercent(tokens),'60%');});
test('missing usage is distinct from a reported cache miss',()=>{assert.equal(cachePercent(),'—');assert.equal(cachePercent({...tokens,cache:{read:0,write:0}}),'0%');});
test('speed excludes TTFT, tool time and reasoning tokens, weighted by time',()=>{const t=fold([{id:'1',start:1000,first:2000,textFirst:2000,chars:100,observed:true,streamEnd:4000,end:11000,tokens,toolMs:7000},{id:'2',start:10000,first:11000,textFirst:11000,chars:100,observed:true,streamEnd:19000,end:19000,tokens,toolMs:0}]);assert.equal(speed(t),'12.0 tok/s');assert.equal(t.modelMs,12000);assert.equal(t.ttftMs/t.ttftSteps,1000);assert.equal(t.toolMs,7000);});
test('a reply that arrives as one batch has no measurable span',()=>{const t=fold([observeOutput({id:'1',start:0,streamEnd:1015,end:1015,chars:5,tokens,toolMs:0},'hello',1000,true)]);assert.equal(speed(t),'— tok/s');assert.equal(t.ttftMs,1000);assert.equal(t.decodeTokens,0);});
test('partial cache hits never round up to full hit',()=>{assert.equal(cachePercent({...tokens,input:1,cache:{read:9999,write:0}}),'99.99%');});
test('formatting handles unavailable and large counts',()=>{assert.equal(compact(),'—');assert.equal(compact(12946),'12.9K');});

test('V2 stream completion excludes tools; a reasoning start gives TTFT but no speed',()=>{
  const message={id:'v2',type:'assistant',time:{created:0,streamed:11000,completed:311000},tokens:{...tokens,output:600,reasoning:400},content:[{type:'reasoning',text:'thinking',time:{created:1000,completed:10900}},{type:'tool',name:'shell',time:{created:7000,ran:11000,completed:311000}}]} as any;
  const r=reading(message)!;const t=fold([r]);assert.equal(r.first,1000);assert.equal(t.modelMs,11000);assert.equal(t.toolMs,300000);assert.equal(t.ttftMs,1000);assert.equal(speed(t),'— tok/s');
});
test('cached projections cannot overwrite the first live text batch',()=>{
  const textTokens={...tokens,output:100,reasoning:0};
  const live=observeOutput(observeOutput({id:'x',start:0,streamEnd:11000,end:11100,tokens:textTokens,toolMs:0},'hello',1000,true),'world',2000,true);
  const cache=reading({id:'x',type:'assistant',time:{created:0,streamed:11000,completed:11100},tokens:textTokens,content:[{type:'text',text:'helloworld'.repeat(5)}]} as any)!;
  assert.equal(cache.first,undefined);assert.equal(speed(fold([mergeReading(live,cache)])),'9.0 tok/s');
  assert.equal(speed(fold([cache])),'— tok/s');
});

test('a tool call that arrives whole gives TTFT but no speed',()=>{
  const r=reading({id:'batch',type:'assistant',time:{created:0,streamed:11000,completed:12000},tokens:{...tokens,reasoning:531},content:[{type:'reasoning',time:{created:10800,completed:10804}},{type:'tool',name:'shell',time:{created:10810,ran:11000,completed:12000}}]} as any)!;
  assert.equal(r.first,10810);assert.equal(fold([r]).ttftMs,10810);assert.equal(speed(fold([r])),'— tok/s');
});

test('timeline usage excludes title overhead and keeps thinking/cache buckets',()=>{
  const reply={input:10917,output:10,reasoning:0,cache:{read:0,write:0}};
  assert.deepEqual(sumUsage([reply]),reply);
  assert.equal(total(sumUsage([reply])!),10927);
  assert.deepEqual(sumUsage([tokens,tokens]),{input:200,output:120,reasoning:80,cache:{read:600,write:200}});
  assert.equal(sumUsage([tokens,undefined]),undefined);
});


test('empty starts and deltas cannot supply a first token',()=>{
  const r=reading({id:'empty',type:'assistant',time:{created:0,streamed:2000,completed:2100},tokens,content:[{type:'reasoning',text:'',time:{created:100,completed:1500}}]} as any)!;
  assert.equal(r.first,undefined);
  assert.equal(observeOutput(r,'',100),r);
  assert.equal(observeOutput(r,'hello',-1),r);
});

test('observed reasoning gives TTFT; speed starts at the first text batch',()=>{
  const r={id:'live',start:0,toolMs:0};
  const live=observeOutput(observeOutput(observeOutput(r,'thinking',1000),'more',2000),'answ',6000,true);
  const projection=reading({id:'live',type:'assistant',time:{created:0,streamed:11000,completed:12000},tokens,content:[{type:'reasoning',text:'',time:{created:10800,completed:10809}},{type:'text',text:'answer '.repeat(10)}]} as any)!;
  const merged=mergeReading(live,projection);
  assert.equal(fold([merged]).ttftMs,1000);
  assert.equal(speed(fold([merged])),'11.3 tok/s');
});

test('hidden reasoning tokens stay out of the speed numerator',()=>{
  const r=reading({id:'hidden',type:'assistant',time:{created:0,streamed:11000,completed:12000},tokens,content:[{type:'reasoning',text:'',time:{created:9000,completed:9009}},{type:'text',text:'helloworld'}]} as any)!;
  const timing=fold([observeOutput(r,'he',10000,true)]);
  assert.equal(timing.ttftSteps,1);
  assert.equal(timing.ttftMs,10000);
  assert.equal(speed(timing),'48.0 tok/s');
});

test('stored samples restore after restart and reject invalid ranges',()=>{
  const historical={id:'persist',start:0,streamEnd:11000,end:12000,chars:100,tokens,toolMs:0};
  const live=observeOutput(observeOutput(historical,'thinking',1000),'more',2000,true);
  const sample=JSON.parse(JSON.stringify(timingSample(live)));
  assert.deepEqual(sample,{first:1000,text:2000,lead:4});
  const restored=fold([restoreTiming(historical,sample)]);
  assert.equal(restored.ttftMs,1000);assert.equal(speed(restored),'6.4 tok/s');
  assert.equal(restoreTiming(historical,{first:12000,reasoningObserved:true}),historical);
  assert.equal(restoreTiming(historical,{first:'1000'}),historical);
  assert.equal(restoreTiming(historical,{first:1000,text:12000,lead:4}).textFirst,undefined);
});

test('observed timestamps take precedence over inferred part starts',()=>{
  const live=observeOutput({id:'precedence',start:0,toolMs:0},'text',1000);
  const merged=mergeReading(live,{id:'precedence',start:0,first:100,toolMs:0});
  assert.equal(merged.first,1000);
});


test('real replies delivered in one batch give TTFT but no speed',()=>{
  const gemini=fold([observeOutput({id:'gemini',start:1791627393179,streamEnd:1791627397394,end:1791627397398,chars:5,tokens:{...tokens,output:34,reasoning:0},toolMs:0},'reply',1791627397384,true)]);
  assert.equal(speed(gemini),'— tok/s');
  assert.equal(gemini.ttftMs,4205);
  const greeting=fold([observeOutput({id:'greeting',start:1791631538884,streamEnd:1791631541623,end:1791631541625,chars:7,tokens:{...tokens,output:7,reasoning:0},toolMs:0},'你好，有什么事',1791631541617,true)]);
  assert.equal(speed(greeting),'— tok/s');
  assert.equal(greeting.ttftMs,2733);
});

test('distinct short text batches are measured without a duration gate',()=>{
  const r=observeOutput(observeOutput({id:'short',start:0,streamEnd:1040,end:1040,chars:11,tokens:{...tokens,output:10,reasoning:0},toolMs:0},'first',1000,true),'second',1020,true);
  assert.equal(speed(fold([r])),'136.4 tok/s');
});

test('steps without a text span add neither tokens nor time',()=>{
  const one=observeOutput(observeOutput({id:'one',start:0,streamEnd:2000,end:2000,chars:6,tokens:{...tokens,output:10,reasoning:0},toolMs:0},'one',1000,true),'two',1500,true);
  const two={id:'two',start:10000,first:17990,toolFirst:17990,chars:40,streamEnd:18000,end:90000,tokens:{...tokens,output:90,reasoning:2000},toolMs:72000};
  const t=fold([one,two]);
  assert.equal(speed(t),'5.0 tok/s');assert.equal(t.unmeasured,1);assert.equal(t.ttftSteps,2);
});

test('deltas sharing the first timestamp form one batch; missing usage stays unknown',()=>{
  const r=observeOutput(observeOutput(observeOutput({id:'same',start:0,streamEnd:2000,end:2000,chars:12,tokens:{...tokens,reasoning:0},toolMs:0},'one',1000,true),'two',1000,true),'three!',1500,true);
  assert.equal(r.textLead,6);
  assert.equal(speed(fold([r])),'30.0 tok/s');
  assert.equal(speed(fold([{...r,tokens:undefined}])),'— tok/s');
});

test('legacy first-token samples restore TTFT but not speed',()=>{
  const r=restoreTiming({id:'legacy',start:0,streamEnd:2000,end:2000,chars:40,tokens:{...tokens,output:20,reasoning:0},toolMs:0},{first:1990,reasoningObserved:false});
  assert.equal(fold([r]).ttftMs,1990);assert.equal(speed(fold([r])),'— tok/s');
});

test('zero-length text windows remain unavailable',()=>{assert.equal(speed(fold([{id:'zero',start:0,first:1000,textFirst:1000,chars:100,streamEnd:1000,end:1100,tokens,toolMs:0}])),'— tok/s');});

test('DSH context pressure uses prompt buckets, excludes output and thinking',()=>{
  assert.deepEqual(contextReading(tokens,10000),{used:500,limit:10000,percent:5});
  assert.deepEqual(contextReading(undefined,10000),{used:undefined,limit:10000,percent:undefined});
  assert.equal(contextReading(tokens,0).percent,undefined);
  assert.equal(contextReading({...tokens,input:NaN},10000).percent,undefined);
});

test('a zero-length text window adds no tokens to a mixed aggregate',()=>{
  const a={id:'a',start:0,first:1000,textFirst:1000,chars:100,streamEnd:2000,end:2000,tokens,toolMs:0};
  const b={...a,id:'b',streamEnd:1000,end:1000};
  assert.equal(speed(fold([a,b])),'60.0 tok/s');
});

test('cache rounding matches DSH near full hits and rejects invalid counts',()=>{
  assert.equal(cachePercent({...tokens,input:5,cache:{read:995,write:0}}),'99.5%');
  assert.equal(cachePercent({...tokens,input:0,cache:{read:1000,write:0}}),'100%');
  assert.equal(cachePercent({...tokens,input:1,cache:{read:999999,write:0}}),'99.9999%');
});

test('model durations follow DSH compact minute formatting',()=>{
  assert.equal(duration(470700),'7m 51s');
  assert.equal(duration(5300),'5.3s');
});

test('unnamed historical tool blocks do not invent a first token',()=>{
  const r=reading({id:'empty-tool',type:'assistant',time:{created:0,streamed:2000,completed:2100},tokens,content:[{type:'tool',name:'',time:{created:100}}]} as any)!;
  assert.equal(r.first,undefined);
});


test('output shape counts the text and tool calls behind tokens.output',()=>{
  const r=reading({id:'shape',type:'assistant',time:{created:0,streamed:2000,completed:2100},tokens,content:[{type:'reasoning',text:'hidden plan',time:{created:100,completed:900}},{type:'text',text:'abcde'},{type:'tool',name:'read',state:{status:'running',input:{a:1},metadata:{}},time:{created:1500}},{type:'tool',name:'glob',state:{status:'streaming',input:'{"b"'},time:{created:1200}}]} as any)!;
  assert.equal(r.chars,5+4+7+4+4);
  assert.equal(r.toolFirst,1200);
  assert.equal(reading({id:'placeholder',type:'assistant',time:{created:0},content:[]} as any)!.chars,undefined);
});

test('hidden reasoning and whole tool calls no longer inflate a real Gemini session',()=>{
  // Shaped after ses_eda2d6d21 step 22: 18s of encrypted reasoning, then the
  // call 10ms before the stream ended. The old formula read 203,300 tok/s.
  const tool=reading({id:'tool',type:'assistant',time:{created:0,streamed:18075,completed:18300},tokens:{...tokens,output:31,reasoning:2002},content:[{type:'reasoning',text:'',time:{created:18060,completed:18063}},{type:'tool',name:'read',state:{status:'completed',input:{filePath:'src/metrics.ts'}},time:{created:18065,ran:18075,completed:18300}}]} as any)!;
  // Step 41: 432 hidden reasoning tokens, then 6,340 characters of streamed text.
  const text=observeOutput(reading({id:'text',type:'assistant',time:{created:20000,streamed:51661,completed:51661},tokens:{...tokens,output:3234,reasoning:432},content:[{type:'text',text:'x'.repeat(6340)}]} as any)!,'x'.repeat(20),27287,true);
  const t=fold([tool,text]);
  assert.equal(speed(t),'132.3 tok/s');assert.equal(t.ttftSteps,2);assert.equal(t.unmeasured,1);
});

test('missing usage contributes neither numerator nor denominator',()=>{
  const r={id:'good',start:0,first:1000,textFirst:1000,chars:100,streamEnd:2000,end:2000,tokens,toolMs:0};
  const t=fold([r,{...r,id:'missing',streamEnd:20000,end:20000,tokens:undefined}]);
  assert.equal(speed(t),'60.0 tok/s');
  assert.equal(t.unmeasured,1);
});

test('invalid timing, counts and ordering cannot produce a speed',()=>{
  const r={id:'bad',start:1000,first:1500,textFirst:1500,chars:100,streamEnd:2000,end:2100,tokens,toolMs:0};
  assert.equal(speed(fold([r])),'120.0 tok/s');
  for (const patch of [{start:NaN},{start:-1},{streamEnd:999},{end:1999},{textFirst:999},{textFirst:2001},{textFirst:undefined},{toolFirst:1400},{chars:0},{chars:NaN},{tokens:{...tokens,output:NaN}},{tokens:{...tokens,output:-1}},{tokens:{...tokens,output:0}}]) {
    assert.equal(speed(fold([{...r,...patch}])),'— tok/s');
  }
});
