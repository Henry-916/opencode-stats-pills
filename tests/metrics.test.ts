import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachePercent, total, fold, speed, compact, reading, mergeReading } from '../src/metrics.js';
const tokens = {input:100,output:60,reasoning:40,cache:{read:300,write:100}};
test('disjoint input buckets and reasoning are counted once',()=>{assert.equal(total(tokens),600);assert.equal(cachePercent(tokens),'60%');});
test('missing usage is distinct from a reported cache miss',()=>{assert.equal(cachePercent(),'—');assert.equal(cachePercent({...tokens,cache:{read:0,write:0}}),'0%');});
test('decode speed excludes TTFT and uses weighted time',()=>{const t=fold([{id:'1',start:1000,first:2000,streamEnd:4000,end:11000,tokens,toolMs:7000},{id:'2',start:10000,first:11000,streamEnd:19000,end:19000,tokens,toolMs:0}]);assert.equal(speed(t),'20.0 tok/s');assert.equal(t.modelMs,12000);assert.equal(t.ttftMs/t.ttftSteps,1000);assert.equal(t.toolMs,7000);});
test('zero and batched spans never produce thousands of TPS',()=>{const t=fold([{id:'1',start:0,first:1000,streamEnd:1015,end:1015,tokens,toolMs:0}]);assert.equal(speed(t),'— tok/s');assert.equal(t.unmeasured,1);});
test('partial cache hits never round up to full hit',()=>{assert.equal(cachePercent({...tokens,input:1,cache:{read:9999,write:0}}),'<100%');});
test('formatting handles unavailable and large counts',()=>{assert.equal(compact(),'—');assert.equal(compact(12946),'12.9K');});

test('V2 stream completion excludes tools and includes thinking from first reasoning',()=>{
  const message={id:'v2',type:'assistant',time:{created:0,streamed:11000,completed:311000},tokens:{...tokens,output:600,reasoning:400},content:[{type:'reasoning',time:{created:1000,completed:10900}},{type:'tool',time:{created:7000,ran:11000,completed:311000}}]} as any;
  const r=reading(message)!;const t=fold([r]);assert.equal(r.first,1000);assert.equal(t.modelMs,11000);assert.equal(t.toolMs,300000);assert.equal(speed(t),'100.0 tok/s');
});
test('cached projections cannot overwrite the first live text timestamp',()=>{
  const live={id:'x',start:0,first:1000,streamEnd:11000,end:11100,tokens,toolMs:0};
  const cache=reading({id:'x',type:'assistant',time:{created:0,streamed:11000,completed:11100},tokens,content:[]} as any)!;
  assert.equal(cache.first,undefined);assert.equal(speed(fold([mergeReading(live,cache)])),'10.0 tok/s');
  assert.equal(speed(fold([cache])),'— tok/s');
});

test('batched reasoning metadata cannot yield inflated historical TPS',()=>{
  const r=reading({id:'batch',type:'assistant',time:{created:0,streamed:11000,completed:12000},tokens:{...tokens,reasoning:531},content:[{type:'reasoning',time:{created:10800,completed:10804}},{type:'tool',time:{created:10810,ran:11000,completed:12000}}]} as any)!;
  assert.equal(r.batched,true);assert.equal(speed(fold([r])),'— tok/s');
});
