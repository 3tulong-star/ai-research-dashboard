import assert from "node:assert/strict";
import test from "node:test";
import { diversified } from "../app/lib/automation-rules.ts";
import { decide } from "../app/lib/decision.ts";

test("automatic promotion is diversified and limited",()=>{
  const rows=[
    {primaryChain:"算力",pool:"深度研究池",total:99},{primaryChain:"算力",pool:"深度研究池",total:98},{primaryChain:"算力",pool:"深度研究池",total:97},
    {primaryChain:"机器人",pool:"深度研究池",total:96},{primaryChain:"机器人",pool:"深度研究池",total:95},
    {primaryChain:"芯片",pool:"深度研究池",total:94},{primaryChain:"软件",pool:"AI候选池",total:100},
  ];
  const picked=diversified(rows,10);
  assert.equal(picked.length,5);
  assert.equal(picked.filter(x=>x.primaryChain==="算力").length,2);
  assert.ok(picked.every(x=>x.pool==="深度研究池"));
});

test("shadow model can never emit a live portfolio candidate",()=>{
  const result=decide({industryScore:95,moatScore:95,catalystScore:95,revenueGrowth:50,valuationPercentile:10,positiveProbability:90,expectedExcess:40,permanentLossProbability:1,tradable:1,dataComplete:1,sector:"电子",modelStatus:"SHADOW"});
  assert.equal(result.verdict,"继续研究");
  assert.equal(result.risk.initialPositionPct,0);
  assert.ok(result.reasons.some(x=>x.includes("影子模型")));
});

test("missing market history is a hard rejection",()=>{
  const result=decide({industryScore:95,moatScore:95,catalystScore:95,revenueGrowth:50,valuationPercentile:null,positiveProbability:90,expectedExcess:40,permanentLossProbability:1,tradable:1,dataComplete:0,sector:"电子",modelStatus:"VALIDATED"});
  assert.equal(result.verdict,"拒绝");
  assert.ok(result.reasons.some(reason=>reason.includes("估值历史数据缺失")));
});
