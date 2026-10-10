import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachePercent, total, fold, speed, compact, reading, mergeReading, sumUsage, observeOutput, timingSample, restoreTiming } from '../src/metrics.js';
const tokens = {input:100,output:60,reasoning:40,cache:{read:300,write:100}};
test('disjoint input buckets and reasoning are counted once',()=>{assert.equal(total(tokens),600);assert.equal(cachePercent(tokens),'60%');});
test('missing usage is distinct from a reported cache miss',()=>{assert.equal(cachePercent(),'—');assert.equal(cachePercent({...tokens,cache:{read:0,write:0}}),'0%');});
test('decode speed excludes TTFT and uses weighted time',()=>{const t=fold([{id:'1',start:1000,first:2000,streamEnd:4000,end:11000,tokens,toolMs:7000},{id:'2',start:10000,first:11000,streamEnd:19000,end:19000,tokens,toolMs:0}]);assert.equal(speed(t),'20.0 tok/s');assert.equal(t.modelMs,12000);assert.equal(t.ttftMs/t.ttftSteps,1000);assert.equal(t.toolMs,7000);});
test('zero and batched spans never produce thousands of TPS',()=>{const t=fold([{id:'1',start:0,first:1000,streamEnd:1015,end:1015,tokens,toolMs:0}]);assert.equal(speed(t),'— tok/s');assert.equal(t.unmeasured,1);});
test('partial cache hits never round up to full hit',()=>{assert.equal(cachePercent({...tokens,input:1,cache:{read:9999,write:0}}),'<100%');});
test('formatting handles unavailable and large counts',()=>{assert.equal(compact(),'—');assert.equal(compact(12946),'12.9K');});

test('V2 stream completion excludes tools and includes thinking from first reasoning',()=>{
  const message={id:'v2',type:'assistant',time:{created:0,streamed:11000,completed:311000},tokens:{...tokens,output:600,reasoning:400},content:[{type:'reasoning',text:'thinking',time:{created:1000,completed:10900}},{type:'tool',time:{created:7000,ran:11000,completed:311000}}]} as any;
  const r=reading(message)!;const t=fold([r]);assert.equal(r.first,1000);assert.equal(t.modelMs,11000);assert.equal(t.toolMs,300000);assert.equal(speed(t),'100.0 tok/s');
});
test('cached projections cannot overwrite the first live text timestamp',()=>{
  const textTokens={...tokens,output:100,reasoning:0};
  const live=observeOutput({id:'x',start:0,streamEnd:11000,end:11100,tokens:textTokens,toolMs:0},'text','hello',1000);
  const cache=reading({id:'x',type:'assistant',time:{created:0,streamed:11000,completed:11100},tokens:textTokens,content:[]} as any)!;
  assert.equal(cache.first,undefined);assert.equal(speed(fold([mergeReading(live,cache)])),'10.0 tok/s');
  assert.equal(speed(fold([cache])),'— tok/s');
});

test('batched reasoning metadata cannot yield inflated historical TPS',()=>{
  const r=reading({id:'batch',type:'assistant',time:{created:0,streamed:11000,completed:12000},tokens:{...tokens,reasoning:531},content:[{type:'reasoning',time:{created:10800,completed:10804}},{type:'tool',time:{created:10810,ran:11000,completed:12000}}]} as any)!;
  assert.equal(r.batched,true);assert.equal(speed(fold([r])),'— tok/s');
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
  assert.equal(observeOutput(r,'reasoning','',100),r);
  assert.equal(observeOutput(r,'text','hello',-1),r);
});

test('observed reasoning survives batched projections and supplies full TPS',()=>{
  const r={id:'live',start:0,toolMs:0};
  const live=observeOutput(r,'reasoning','thinking',1000);
  const projection=reading({id:'live',type:'assistant',time:{created:0,streamed:11000,completed:12000},tokens,content:[{type:'reasoning',text:'',time:{created:10800,completed:10809}}]} as any)!;
  const merged=mergeReading(live,projection);
  assert.equal(speed(fold([merged])),'10.0 tok/s');
  assert.equal(fold([merged]).ttftMs,1000);
});

test('hidden reasoning keeps observed TTFT without inflating full TPS',()=>{
  const r=reading({id:'hidden',type:'assistant',time:{created:0,streamed:11000,completed:12000},tokens,content:[{type:'reasoning',text:'',time:{created:9000,completed:9009}},{type:'text',text:'hello'}]} as any)!;
  const measured=observeOutput(r,'text','hello',10000);
  const timing=fold([measured]);
  assert.equal(timing.ttftSteps,1);
  assert.equal(timing.ttftMs,10000);
  assert.equal(speed(timing),'— tok/s');
});

test('stored delta times restore after restart and reject invalid ranges',()=>{
  const historical={id:'persist',start:0,streamEnd:11000,end:12000,tokens,batched:true,toolMs:0};
  const live=observeOutput(historical,'reasoning','thinking',1000);
  const sample=JSON.parse(JSON.stringify(timingSample(live)));
  assert.equal(speed(fold([restoreTiming(historical,sample)])),'10.0 tok/s');
  assert.equal(restoreTiming(historical,{first:12000,reasoningObserved:true}),historical);
  assert.equal(restoreTiming(historical,{first:1000}),historical);
});

test('observed timestamps take precedence over inferred part starts',()=>{
  const live=observeOutput({id:'precedence',start:0,toolMs:0},'reasoning','text',1000);
  const merged=mergeReading(live,{id:'precedence',start:0,first:100,toolMs:0});
  assert.equal(merged.first,1000);
});
