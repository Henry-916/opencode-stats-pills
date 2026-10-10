import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachePercent, contextReading, duration, total, fold, speed, compact, reading, mergeReading, sumUsage, observeOutput, timingSample, restoreTiming } from '../src/metrics.js';
const tokens = {input:100,output:60,reasoning:40,cache:{read:300,write:100}};
test('disjoint input buckets and reasoning are counted once',()=>{assert.equal(total(tokens),600);assert.equal(cachePercent(tokens),'60%');});
test('missing usage is distinct from a reported cache miss',()=>{assert.equal(cachePercent(),'—');assert.equal(cachePercent({...tokens,cache:{read:0,write:0}}),'0%');});
test('decode speed excludes TTFT and uses weighted time',()=>{const t=fold([{id:'1',start:1000,first:2000,observed:true,streamEnd:4000,end:11000,tokens,toolMs:7000},{id:'2',start:10000,first:11000,observed:true,streamEnd:19000,end:19000,tokens,toolMs:0}]);assert.equal(speed(t),'20.0 tok/s');assert.equal(t.modelMs,12000);assert.equal(t.ttftMs/t.ttftSteps,1000);assert.equal(t.toolMs,7000);});
test('short positive spans are included without arbitrary duration thresholds',()=>{const t=fold([{id:'1',start:0,first:1000,streamEnd:1015,end:1015,tokens,toolMs:0}]);assert.equal(speed(t),'6666.7 tok/s');assert.equal(t.unmeasured,0);});
test('partial cache hits never round up to full hit',()=>{assert.equal(cachePercent({...tokens,input:1,cache:{read:9999,write:0}}),'99.99%');});
test('formatting handles unavailable and large counts',()=>{assert.equal(compact(),'—');assert.equal(compact(12946),'12.9K');});

test('V2 stream completion excludes tools and includes thinking from first reasoning',()=>{
  const message={id:'v2',type:'assistant',time:{created:0,streamed:11000,completed:311000},tokens:{...tokens,output:600,reasoning:400},content:[{type:'reasoning',text:'thinking',time:{created:1000,completed:10900}},{type:'tool',name:'shell',time:{created:7000,ran:11000,completed:311000}}]} as any;
  const r=reading(message)!;const t=fold([r]);assert.equal(r.first,1000);assert.equal(t.modelMs,11000);assert.equal(t.toolMs,300000);assert.equal(speed(t),'100.0 tok/s');
});
test('cached projections cannot overwrite the first live text timestamp',()=>{
  const textTokens={...tokens,output:100,reasoning:0};
  const live=observeOutput(observeOutput({id:'x',start:0,streamEnd:11000,end:11100,tokens:textTokens,toolMs:0},'hello',1000),'world',2000);
  const cache=reading({id:'x',type:'assistant',time:{created:0,streamed:11000,completed:11100},tokens:textTokens,content:[]} as any)!;
  assert.equal(cache.first,undefined);assert.equal(speed(fold([mergeReading(live,cache)])),'10.0 tok/s');
  assert.equal(speed(fold([cache])),'— tok/s');
});

test('empty reasoning metadata does not replace the tool output timestamp',()=>{
  const r=reading({id:'batch',type:'assistant',time:{created:0,streamed:11000,completed:12000},tokens:{...tokens,reasoning:531},content:[{type:'reasoning',time:{created:10800,completed:10804}},{type:'tool',name:'shell',time:{created:10810,ran:11000,completed:12000}}]} as any)!;
  assert.equal(r.first,10810);assert.equal(speed(fold([r])),'3110.5 tok/s');
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

test('observed reasoning survives batched projections and supplies full TPS',()=>{
  const r={id:'live',start:0,toolMs:0};
  const live=observeOutput(observeOutput(r,'thinking',1000),'more',2000);
  const projection=reading({id:'live',type:'assistant',time:{created:0,streamed:11000,completed:12000},tokens,content:[{type:'reasoning',text:'',time:{created:10800,completed:10809}}]} as any)!;
  const merged=mergeReading(live,projection);
  assert.equal(speed(fold([merged])),'10.0 tok/s');
  assert.equal(fold([merged]).ttftMs,1000);
});

test('reported reasoning tokens are included in the single decode-speed formula',()=>{
  const r=reading({id:'hidden',type:'assistant',time:{created:0,streamed:11000,completed:12000},tokens,content:[{type:'reasoning',text:'',time:{created:9000,completed:9009}},{type:'text',text:'hello'}]} as any)!;
  const measured=observeOutput(r,'hello',10000);
  const timing=fold([measured]);
  assert.equal(timing.ttftSteps,1);
  assert.equal(timing.ttftMs,10000);
  assert.equal(speed(timing),'100.0 tok/s');
});

test('stored delta times restore after restart and reject invalid ranges',()=>{
  const historical={id:'persist',start:0,streamEnd:11000,end:12000,tokens,toolMs:0};
  const live=observeOutput(observeOutput(historical,'thinking',1000),'more',2000);
  const sample=JSON.parse(JSON.stringify(timingSample(live)));
  assert.equal(speed(fold([restoreTiming(historical,sample)])),'10.0 tok/s');
  assert.equal(restoreTiming(historical,{first:12000,reasoningObserved:true}),historical);
  assert.equal(restoreTiming(historical,{first:'1000'}),historical);
});

test('observed timestamps take precedence over inferred part starts',()=>{
  const live=observeOutput({id:'precedence',start:0,toolMs:0},'text',1000);
  const merged=mergeReading(live,{id:'precedence',start:0,first:100,toolMs:0});
  assert.equal(merged.first,1000);
});


test('real 10ms coalesced Gemini reply follows the DSH decode formula',()=>{
  const r=observeOutput({id:'gemini',start:1791627393179,streamEnd:1791627397394,end:1791627397398,tokens:{...tokens,output:34,reasoning:0},toolMs:0},'reply',1791627397384);
  const timing=fold([r]);
  assert.equal(speed(timing),'3400.0 tok/s');
  assert.equal(timing.ttftMs,4205);
});

test('distinct short deltas are measured without a 100ms gate',()=>{
  const r=observeOutput(observeOutput({id:'short',start:0,streamEnd:1040,end:1040,tokens:{...tokens,output:10,reasoning:0},toolMs:0},'first',1000),'second',1020);
  assert.equal(speed(fold([r])),'250.0 tok/s');
});

test('unmeasured steps do not contribute tokens or time to the decode average',()=>{
  const one=observeOutput(observeOutput({id:'one',start:0,streamEnd:2000,end:2000,tokens:{...tokens,output:10,reasoning:0},toolMs:0},'one',1000),'two',1500);
  const two={id:'two',start:10000,streamEnd:18000,end:90000,tokens:{...tokens,output:90,reasoning:0},toolMs:72000};
  assert.equal(speed(fold([one,two])),'10.0 tok/s');
});

test('a single output delta suffices while missing usage stays unknown',()=>{
  const r=observeOutput(observeOutput({id:'same',start:0,streamEnd:2000,end:2000,tokens:{...tokens,reasoning:0},toolMs:0},'one',1000),'two',1000);
  assert.equal(speed(fold([r])),'60.0 tok/s');
  assert.equal(speed(fold([{...r,tokens:undefined}])),'— tok/s');
});

test('legacy persisted first-token samples retain their decode timing',()=>{
  const r=restoreTiming({id:'legacy',start:0,streamEnd:2000,end:2000,tokens:{...tokens,output:20,reasoning:0},toolMs:0},{first:1990,reasoningObserved:false});
  assert.equal(speed(fold([r])),'2000.0 tok/s');
});

test('zero-duration decode samples remain unavailable',()=>{assert.equal(speed(fold([{id:'zero',start:0,first:1000,streamEnd:1000,end:1100,tokens,toolMs:0}])),'— tok/s');});

test('DSH context pressure uses prompt buckets, excludes output and thinking',()=>{
  assert.deepEqual(contextReading(tokens,10000),{used:500,limit:10000,percent:5});
  assert.deepEqual(contextReading(undefined,10000),{used:undefined,limit:10000,percent:undefined});
  assert.equal(contextReading(tokens,0).percent,undefined);
  assert.equal(contextReading({...tokens,input:NaN},10000).percent,undefined);
});

test('DSH includes zero-duration output in a mixed decode aggregate',()=>{
  const a={id:'a',start:0,first:1000,streamEnd:2000,end:2000,tokens,toolMs:0};
  const b={...a,id:'b',streamEnd:1000,end:1000};
  assert.equal(speed(fold([a,b])),'200.0 tok/s');
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


test('real short greeting keeps DSH decode timing without a rate cap',()=>{
  const r={id:'greeting',start:1791631538884,first:1791631541617,streamEnd:1791631541623,end:1791631541625,tokens:{...tokens,output:7,reasoning:0},toolMs:0};
  assert.equal(speed(fold([r])),'1166.7 tok/s');
  assert.equal(speed(fold([{...r,first:undefined}])),'— tok/s');
});

test('missing usage contributes neither numerator nor denominator',()=>{
  const r={id:'good',start:0,first:1000,streamEnd:2000,end:2000,tokens,toolMs:0};
  const t=fold([r,{...r,id:'missing',streamEnd:20000,end:20000,tokens:undefined}]);
  assert.equal(speed(t),'100.0 tok/s');
  assert.equal(t.unmeasured,1);
});

test('invalid timing and counts cannot produce a decode rate',()=>{
  const r={id:'bad',start:1000,first:1500,streamEnd:2000,end:2100,tokens,toolMs:0};
  for (const patch of [{start:NaN},{start:-1},{streamEnd:999},{end:1999},{first:999},{first:2001},{tokens:{...tokens,output:NaN}},{tokens:{...tokens,reasoning:-1}},{tokens:{...tokens,output:Number.MAX_VALUE,reasoning:Number.MAX_VALUE}}]) {
    assert.equal(speed(fold([{...r,...patch}])),'— tok/s');
  }
  assert.equal(speed(fold([{...r,tokens:{...tokens,output:0,reasoning:0}}])),'— tok/s');
});
