import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargeCost, money, parsePrices, sessionCost, tokenCost } from '../src/cost.js';
const near = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-12);
const t = {input:100,output:60,reasoning:40,cache:{read:300,write:100}};
const price = {input:1,output:2,cacheRead:0.1};
const model = {providerID:'relay',id:'test'};
const prices = {relay:{test:price}};

test('custom prices count thinking as output and cache writes as input once',()=>{
  near(tokenCost(t,price),0.00043);
  near(tokenCost({...t,cache:{read:0,write:100}},{input:1,output:2}),0.0004);
  near(chargeCost({model,tokens:t,cost:100},prices,[]),0.00043);
});
test('missing cache rate is unknown only when that bucket is used',()=>{
  assert.equal(tokenCost(t,{input:1,output:2}),undefined);
  near(tokenCost({...t,cache:{read:0,write:0}},{input:1,output:2}),0.0003);
  assert.equal(tokenCost(t,{input:0,output:0,cacheRead:0}),0);
});
test('validate config and preserve explicit zero',()=>{
  assert.deepEqual(parsePrices(undefined),{});
  assert.deepEqual(parsePrices({relay:{test:{input:0,output:0}}}),{relay:{test:{input:0,output:0}}});
  for(const bad of [null,[],{relay:[]},{relay:{test:{input:-1,output:2}}},{relay:{test:{input:1}}},{relay:{test:{input:1,output:2,typo:1}}},{relay:{test:{input:NaN,output:2}}},{relay:{test:{input:1,output:2,reasoning:3}}},{relay:{test:{input:1,output:2,cacheWrite:1.25}}}]) assert.throws(()=>parsePrices(bad));
});
test('host zero requires known free model; positive reported cost is retained',()=>{
  assert.equal(chargeCost({model,cost:0},{},[]),undefined);
  assert.equal(chargeCost({model,cost:0.3},{},[]),0.3);
  const free = {providerID:'relay',modelID:'test',cost:[{input:0,output:0,cache:{read:0,write:0}}]} as any;
  assert.equal(chargeCost({model,cost:0},{},[free]),0);
  assert.equal(chargeCost({model,cost:0},{},[{...free,cost:[]}]),undefined);
});
test('model switches use request prices; session totals exclude host title charges',()=>{
  const other={providerID:'other',id:'test'};
  const charges=[{model,tokens:t},{model:other,tokens:t,cost:0.5}];
  near(sessionCost(charges,prices,[]),0.50043);
  assert.equal(sessionCost([{model,tokens:t},{model:other,tokens:t,cost:0}],prices,[]),undefined);
});
test('session costs use only request charges and preserve unknown costs',()=>{
  near(sessionCost([{model,tokens:t}],prices,[]),0.00043);
  assert.equal(sessionCost([],prices,[]),0);
  assert.equal(sessionCost([{model,cost:0}],{},[]),undefined);
});
test('money distinguishes unknown, free, tiny and ordinary costs',()=>{
  assert.equal(money(),'$ —');assert.equal(money(0),'$ 0.00');
  assert.equal(money(0.00455),'$ 0.0046');assert.equal(money(0.000001),'$ <0.0001');
  assert.equal(money(0.42),'$ 0.42');
});
