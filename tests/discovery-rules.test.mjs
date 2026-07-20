import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { scoreCandidate } from "../app/lib/discovery.ts";

const board=(name,chain="算力基础设施",relevance=100,up=50,down=30)=>({code:"BKTEST",name,change:1,up,down,chain,relevance});
const base={code:"600000",name:"技术公司",industry:"通信设备",price:30,change:1,amount:2e9,turnover:3,pe:28,pb:3,marketCap:8e10,floatCap:7e10,change60:20,changeYtd:30,boards:[board("CPO概念"),board("数据中心")]};

test("high quality multi-theme company reaches deep research",()=>{
  const result=scoreCandidate(base);
  assert.equal(result.pool,"深度研究池");
  assert.ok(result.total>=85);
});

test("concept hitchhiker is downgraded by main-business fit",()=>{
  const real=scoreCandidate(base);
  const hitchhiker=scoreCandidate({...base,name:"零售公司",industry:"商业百货"});
  assert.ok(real.total-hitchhiker.total>=10);
  assert.notEqual(hitchhiker.pool,"深度研究池");
});

test("ST and illiquid stocks are hard-vetoed",()=>{
  const result=scoreCandidate({...base,name:"ST技术",amount:2e7,marketCap:1e9});
  assert.equal(result.pool,"风险淘汰池");
  assert.ok(result.vetoes.length>=3);
});

test("overheated loss maker scores below a healthy peer",()=>{
  const healthy=scoreCandidate(base);
  const hot=scoreCandidate({...base,pe:-20,change60:180,changeYtd:260,turnover:28});
  assert.ok(healthy.total-hot.total>=20);
});

test("market discovery uses bounded serial requests with resilient backoff",async()=>{
  const source=await readFile(new URL("../app/lib/discovery.ts",import.meta.url),"utf8");
  assert.match(source,/retries=5/);
  assert.match(source,/800\*\(2\*\*i\)/);
  assert.match(source,/for\(const board of batch\)/);
  assert.doesNotMatch(source,/Promise\.all\(batch\.map/);
});
