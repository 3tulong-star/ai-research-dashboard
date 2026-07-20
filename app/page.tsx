"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
type Workspace = { companies: Row[]; evidence: Row[]; snapshots: Row[]; decisions: Row[]; reviews: Row[]; discoveryRuns:Row[]; discoveryCandidates:Row[]; sourceLogs:Row[]; automationRuns:Row[]; automationExceptions:Row[] };
const empty: Workspace = { companies: [], evidence: [], snapshots: [], decisions: [], reviews: [], discoveryRuns:[], discoveryCandidates:[], sourceLogs:[], automationRuns:[], automationExceptions:[] };
const tabs = ["总览", "自动发现", "标的库", "证据台", "三本账", "决策单", "复盘"];

const validation = [
  ["24月超额中位数", "+8.17pp", "good"], ["行动/拒绝价差", "+15.78pp", "good"],
  ["正超额比例", "63.64%", "good"], ["永久损失比例", "5.45%", "good"],
];

function parse(value: string) { try { return JSON.parse(value); } catch { return []; } }
function Field({ label, name, type="text", defaultValue, required=true }: { label:string; name:string; type?:string; defaultValue?:string|number; required?:boolean }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} defaultValue={defaultValue} required={required}/></label>;
}
function SelectCompany({ rows }: { rows: Row[] }) {
  return <label className="field"><span>标的</span><select name="companyId" required>{rows.map(c=><option key={c.id} value={c.id}>{c.name} · {c.ticker}</option>)}</select></label>;
}

export default function Home() {
  const [active, setActive] = useState("总览");
  const [data, setData] = useState<Workspace>(empty);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("正在连接研究数据库…");
  const [poolFilter,setPoolFilter]=useState("全部");

  async function load() {
    setBusy(true);
    const r = await fetch("/api/workspace"); const j = await r.json();
    if (!r.ok) throw new Error(j.error || "读取失败");
    setData(j); setMessage("数据已同步"); setBusy(false);
  }
  // Database synchronization is the external system this effect owns.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{ load().catch(e=>{setMessage(e.message);setBusy(false);}); },[]);
  async function submit(action:string, event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("正在保存并记录审计轨迹…");
    const form = new FormData(event.currentTarget); const payload:Row={action};
    form.forEach((v,k)=>payload[k]=v); for(const k of ["tradable","dataComplete"]) payload[k]=form.has(k);
    try { const r=await fetch("/api/workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); const j=await r.json(); if(!r.ok)throw new Error(j.error); setData(j); setMessage("已保存 · "+new Date().toLocaleTimeString("zh-CN")); event.currentTarget.reset(); }
    catch(e){setMessage(e instanceof Error?e.message:"保存失败");} finally{setBusy(false);}
  }
  const latest = useMemo(()=>data.decisions[0], [data]);
  const latestAutomation = useMemo(()=>data.automationRuns[0], [data]);
  const visibleCandidates=useMemo(()=>data.discoveryCandidates.filter(c=>poolFilter==="全部"||c.pool===poolFilter),[data,poolFilter]);
  const coverage = data.companies.length ? Math.round(data.snapshots.length/data.companies.length*100) : 0;

  return <main>
    <header className="topbar">
      <div className="brand"><div className="mark">三</div><div><b>三本账 · AI 投资研究台</b><span>Evidence → Research → Decision</span></div></div>
      <div className="status"><i className={busy?"pulse":""}/>{message}</div>
    </header>
    <nav>{tabs.map(t=><button key={t} className={active===t?"active":""} onClick={()=>setActive(t)}>{t}</button>)}</nav>

    {active==="总览" && <section className="page">
      <div className="hero">
        <div><span className="eyebrow">REENTRY-0.7A · SIGNAL VALIDATED</span><h1>AI先找标的，<br/>证据与数字决定去留。</h1><p>全市场扫描负责发现，三本账负责研究，冻结闸门负责决策。热度只能产生线索，不能直接产生买入建议。</p><button className="primary" onClick={()=>setActive("自动发现")}>运行全市场扫描 →</button></div>
        <div className="gate-card"><span>冻结决策闸门</span><strong>P(正超额) ≥ 55%</strong><strong>24M 超额 ≥ 10pp</strong><strong>P(永久损失) ≤ 10%</strong><strong>ST / 停牌 / 缺数 = 否决</strong></div>
      </div>
      <div className="metrics">{validation.map(([a,b,c])=><div className="metric" key={a}><span>{a}</span><b className={c}>{b}</b><small>历史盲测 · 55次行动</small></div>)}</div>
      <div className="grid2">
        <article className="panel"><div className="panel-title"><div><span>PIPELINE</span><h2>收集—研究—决策闭环</h2></div><em>{coverage}% 快照覆盖</em></div>
          <div className="pipeline six">{[["01","发现",data.discoveryCandidates.length],["02","标的",data.companies.length],["03","证据",data.evidence.length],["04","三本账",data.snapshots.length],["05","决策",data.decisions.length],["06","复盘",data.reviews.length]].map(([n,l,v])=><div key={String(n)}><i>{n}</i><span>{l}</span><b>{v}</b></div>)}</div>
        </article>
        <article className="panel"><div className="panel-title"><div><span>LATEST DECISION</span><h2>最近一次决策</h2></div></div>
          {latest?<div className="latest"><div className={`verdict ${latest.verdict}`}>{latest.verdict}</div><h3>{latest.company_name} <small>{latest.ticker}</small></h3><p>综合评分 {latest.score} / 100</p><div className="chips">{parse(latest.reasons_json).slice(0,3).map((x:string)=><span key={x}>{x}</span>)}</div></div>:<div className="blank">尚无决策。先录入三本账快照，再让系统执行冻结规则。</div>}
        </article>
      </div>
      <article className="panel"><div className="panel-title"><div><span>FOCUS LIST</span><h2>重点研究队列</h2></div><button className="ghost" onClick={()=>setActive("标的库")}>管理标的</button></div><div className="table"><div className="tr head"><span>标的</span><span>行业</span><span>类型</span><span>状态</span></div>{data.companies.map(c=><div className="tr" key={c.id}><span><b>{c.name}</b><small>{c.ticker}</small></span><span>{c.sector}</span><span>{c.category}</span><span><i className="tag">{c.status}</i></span></div>)}</div></article>
    </section>}

    {active==="自动发现" && <section className="page"><PageHead k="MARKET DISCOVERY" title="AI 全市场发现" desc="从A股概念板块自动建立AI产业候选池。题材与行情只负责发现，进入研究池后仍需补齐A/B级证据和三本账。"/>
      <div className="discovery-hero"><article className="panel run-panel"><span className="eyebrow">UNATTENDED PIPELINE</span><h2>系统按计划自动研究</h2><p>每个交易日收盘后自动扫描全市场、分散晋级候选、抓取财报和官方公告、冻结三本账并生成影子决策。你只处理异常，不再逐项填表。</p><form onSubmit={e=>submit("runAutomation",e)}><button className="primary" disabled={busy}>{busy?"流水线运行或同步中…":"立即补跑一次"}</button></form></article>
        <article className="panel run-status"><span>LATEST AUTOMATION</span>{latestAutomation?<><strong className={latestAutomation.status==="SUCCESS"?"good":"bad"}>{latestAutomation.status} · {latestAutomation.stage}</strong><div><b>{latestAutomation.promoted_count||0}</b><small>自动晋级</small><b>{latestAutomation.snapshot_count||0}</b><small>三本账</small><b>{latestAutomation.exception_count||0}</b><small>待处理异常</small></div><p>{latestAutomation.completed_at||latestAutomation.started_at} · {latestAutomation.model_version}</p></>:<div className="blank">定时任务尚未产生第一批完整运行记录。</div>}</article>
      </div>
      <article className="panel"><div className="panel-title"><div><span>EXCEPTION ONLY</span><h2>只需人工处理这些异常</h2></div><em>{data.automationExceptions.length} 条未解决</em></div>{data.automationExceptions.length?<div className="table"><div className="tr five head"><span>标的</span><span>阶段</span><span>级别</span><span>问题</span><span>可重试</span></div>{data.automationExceptions.map(x=><div className="tr five" key={x.id}><span><b>{x.company_name||"全局"}</b><small>运行 #{x.run_id}</small></span><span>{x.stage}</span><span>{x.severity}</span><span>{x.message}</span><span>{x.retryable?"是":"否"}</span></div>)}</div>:<div className="blank">当前没有未解决异常。</div>}</article>
      <article className="panel"><div className="panel-title"><div><span>FROZEN DISCOVERY MODEL · 0.1</span><h2>发现评分与硬否决</h2></div></div><div className="weights">{[["主题相关",20],["主营相关",20],["流动性",15],["估值",15],["趋势不过热",10],["板块广度",10],["规模",5],["风险",5]].map(([x,w])=><div key={String(x)}><span>{x}</span><b>{w}%</b></div>)}</div><p className="method-note">硬否决：ST/退市风险、无有效价格、成交额低于5,000万元、总市值低于20亿元。主营行业不相关的“蹭概念”公司会被显著降级；负利润和过热行情扣分，但不会被伪装成绝对真理。</p></article>
      <div className="candidate-toolbar"><div>{["全部","深度研究池","AI候选池","全市场观察池","风险淘汰池"].map(x=><button className={poolFilter===x?"active":""} key={x} onClick={()=>setPoolFilter(x)}>{x}<small>{x==="全部"?data.discoveryCandidates.length:data.discoveryCandidates.filter(c=>c.pool===x).length}</small></button>)}</div><span>按总分排序 · 同批次横向比较</span></div>
      <div className="candidate-list">{visibleCandidates.map(c=><article key={c.id} className="candidate"><div className="rank">#{String(c.rank).padStart(2,"0")}</div><div className="candidate-main"><div><i className={`pool ${c.pool}`}>{c.pool}</i><span>{c.primary_chain}</span></div><h2>{c.name}<small>{c.code}</small></h2><div className="theme-row">{parse(c.themes_json).slice(0,4).map((x:string)=><span key={x}>{x}</span>)}</div><p>{c.pool==="风险淘汰池"?parse(c.vetoes_json).join("；"):parse(c.reasons_json)[0]}</p></div><div className="score-stack"><strong>{c.total_score}</strong><span>发现总分</span><div><b>主题 {Math.round(c.theme_score)}</b><b>估值 {Math.round(c.valuation_score)}</b><b>趋势 {Math.round(c.momentum_score)}</b></div></div><div className="market-facts"><span>PE<b>{c.pe>0?Number(c.pe).toFixed(1):"亏损"}</b></span><span>PB<b>{Number(c.pb).toFixed(1)}</b></span><span>60日<b className={c.change_60d>70?"bad":""}>{c.change_60d}%</b></span><span>市值<b>{Math.round(c.market_cap/1e8)}亿</b></span></div><form onSubmit={e=>submit("promoteCandidate",e)}><input type="hidden" name="candidateId" value={c.id}/><button className="ghost" disabled={c.pool==="风险淘汰池"}>进入研究池 →</button></form></article>)}</div>
      {!visibleCandidates.length&&<div className="blank">当前筛选下没有候选；先运行一次全市场扫描。</div>}
      <article className="panel source-audit"><div><span>SOURCE AUDIT</span><h2>数据源审计</h2></div>{data.sourceLogs.map(s=><p key={s.id}><i className={s.status==="SUCCESS"?"good":"bad"}>{s.status}</i><b>{s.source}</b><span>{s.endpoint}</span><small>{s.retrieved_at} · {String(s.raw_hash||"").slice(0,16)}…</small></p>)}</article>
    </section>}

    {active==="标的库" && <section className="page"><PageHead k="RESEARCH UNIVERSE" title="研究标的库" desc="默认由AI发现系统送入；人工入口只用于补充漏网标的和ETF。"/>
      <div className="grid2"><article className="panel"><h2>人工补充标的</h2><form onSubmit={e=>submit("addCompany",e)} className="form-grid"><Field label="代码" name="ticker" defaultValue=""/><Field label="名称" name="name"/><Field label="行业" name="sector"/><label className="field"><span>类型</span><select name="category"><option>个股</option><option>ETF</option></select></label><label className="field wide"><span>为什么自动扫描可能遗漏它</span><textarea name="thesis" required/></label><button className="primary wide">人工补充</button></form></article><article className="panel note"><span className="eyebrow">规则</span><h2>发现不等于推荐</h2><p>自动入池只代表值得研究。数据适配器记录为C级线索；必须补充公告、财报等A/B级证据，完成三本账后才有资格进入决策。</p></article></div>
      <article className="panel"><div className="table"><div className="tr five head"><span>标的</span><span>行业</span><span>研究假设</span><span>证据</span><span>状态</span></div>{data.companies.map(c=><div className="tr five" key={c.id}><span><b>{c.name}</b><small>{c.ticker}</small></span><span>{c.sector}</span><span>{c.thesis}</span><span>{data.evidence.filter(e=>e.company_id===c.id).length} 条</span><span><i className="tag">{c.status}</i></span></div>)}</div></article>
    </section>}

    {active==="证据台" && <section className="page"><PageHead k="EVIDENCE LEDGER" title="证据台" desc="所有信息源、发布日期、立场和判断类型都必须留痕。"/>
      <article className="panel"><form onSubmit={e=>submit("addEvidence",e)} className="form-grid three"><SelectCompany rows={data.companies}/><Field label="证据标题" name="title"/><Field label="发布日期" name="publishedAt" type="date" defaultValue={new Date().toISOString().slice(0,10)}/><Field label="原始来源 URL" name="sourceUrl" type="url" required={false}/><label className="field"><span>来源等级</span><select name="sourceGrade"><option>A · 公告/监管/原始数据</option><option>B · 权威媒体/机构</option><option>C · 二手观点</option></select></label><label className="field"><span>证据类型</span><select name="evidenceType"><option>事实</option><option>估计</option><option>判断</option><option>情景</option></select></label><label className="field"><span>立场</span><select name="stance"><option>支持</option><option>反对</option><option>中性</option></select></label><label className="field wide"><span>摘录与备注</span><textarea name="notes"/></label><button className="primary">保存证据</button></form></article>
      <article className="panel"><div className="table"><div className="tr five head"><span>标的 / 日期</span><span>证据</span><span>等级</span><span>立场</span><span>来源</span></div>{data.evidence.map(e=><div className="tr five" key={e.id}><span><b>{e.company_name}</b><small>{e.published_at}</small></span><span>{e.title}</span><span>{e.source_grade}</span><span><i className={`tag ${e.stance}`}>{e.stance}</i></span><span>{e.source_url?<a href={e.source_url} target="_blank">原文 ↗</a>:"未附链接"}</span></div>)}</div></article>
    </section>}

    {active==="三本账" && <section className="page"><PageHead k="THREE LEDGERS" title="三本账研究快照" desc="财务事实、产业质量、市场定价必须在同一时点冻结，避免事后改口径。"/>
      <form onSubmit={e=>submit("saveSnapshot",e)} className="ledger-form"><article className="panel"><h2><i>01</i> 财务账</h2><SelectCompany rows={data.companies}/><Field label="报告期" name="period" defaultValue="2026Q2"/><Field label="营收同比 %" name="revenueGrowth" type="number" defaultValue="20"/><Field label="利润率趋势 pp" name="marginTrend" type="number" defaultValue="2"/><Field label="现金流质量 0-100" name="cfoQuality" type="number" defaultValue="70"/><Field label="存货-收入增速差 pp" name="inventoryGap" type="number" defaultValue="0"/><Field label="资产负债率 %" name="debtRatio" type="number" defaultValue="35"/></article>
      <article className="panel"><h2><i>02</i> 产业与公司账</h2><Field label="行业景气 0-100" name="industryScore" type="number" defaultValue="70"/><Field label="护城河 0-100" name="moatScore" type="number" defaultValue="70"/><Field label="催化剂 0-100" name="catalystScore" type="number" defaultValue="65"/><Field label="正超额概率 %" name="positiveProbability" type="number" defaultValue="55"/><Field label="预期24月超额 pp" name="expectedExcess" type="number" defaultValue="10"/><Field label="永久损失概率 %" name="permanentLossProbability" type="number" defaultValue="10"/></article>
      <article className="panel"><h2><i>03</i> 估值与市场账</h2><Field label="估值历史分位 %" name="valuationPercentile" type="number" defaultValue="60"/><Field label="距高点回撤 %" name="drawdown" type="number" defaultValue="-10"/><Field label="年化波动率 %" name="volatility" type="number" defaultValue="35"/><label className="check"><input type="checkbox" name="tradable" defaultChecked/> 非 ST、非停牌且可交易</label><label className="check"><input type="checkbox" name="dataComplete" defaultChecked/> 关键数据完整</label><div className="rulebox">保存的是“当时可知”的数据，不允许使用未来信息。录入后到决策单执行规则。</div><button className="primary">冻结研究快照</button></article></form>
      <article className="panel"><div className="table"><div className="tr five head"><span>标的 / 期次</span><span>正超额概率</span><span>预期超额</span><span>永久损失</span><span>估值分位</span></div>{data.snapshots.map(s=><div className="tr five" key={s.id}><span><b>{s.company_name}</b><small>{s.period}</small></span><span>{s.positive_probability}%</span><span>{s.expected_excess}pp</span><span>{s.permanent_loss_probability}%</span><span>{s.valuation_percentile}%</span></div>)}</div></article>
    </section>}

    {active==="决策单" && <section className="page"><PageHead k="DECISION ENGINE" title="决策单" desc="评分用于排序，四道冻结闸门决定是否有资格进入组合。"/>
      <div className="grid2"><article className="panel"><h2>执行冻结规则</h2>{data.snapshots.length?<form onSubmit={e=>submit("makeDecision",e)}><label className="field"><span>选择研究快照</span><select name="snapshotId">{data.snapshots.map(s=><option value={s.id} key={s.id}>{s.company_name} · {s.period} · P+ {s.positive_probability}%</option>)}</select></label><button className="primary full">生成并锁定决策</button></form>:<div className="blank">请先录入一份三本账快照。</div>}</article><article className="panel gate-list"><h2>绝对数字标尺</h2><p><b>①</b><span>正超额概率</span><strong>≥ 55%</strong></p><p><b>②</b><span>24个月预期超额</span><strong>≥ 10pp</strong></p><p><b>③</b><span>永久损失概率</span><strong>≤ 10%</strong></p><p><b>④</b><span>交易与数据完整性</span><strong>必须通过</strong></p></article></div>
      <div className="decision-grid">{data.decisions.map(d=>{const reasons=parse(d.reasons_json),risk=parse(d.risk_json);return <article className="decision" key={d.id}><div><span>{d.created_at}</span><i className={`verdict ${d.verdict}`}>{d.verdict}</i></div><h2>{d.company_name}<small>{d.ticker}</small></h2><div className="score"><b>{d.score}</b><span>/100<br/>综合排序分</span></div><ul>{reasons.map((x:string)=><li key={x}>{x}</li>)}</ul><footer>建议初始仓位 <b>{risk.initialPositionPct}%</b> · 价格复核闸门 {risk.reviewDrawdownPct}%</footer></article>})}</div>
    </section>}

    {active==="复盘" && <section className="page"><PageHead k="AUDIT & REVIEW" title="复盘账" desc="记录结果、相对基准的超额和错误类型，让系统从实际决策中迭代。"/>
      <div className="grid2"><article className="panel"><form onSubmit={e=>submit("addReview",e)} className="form-grid"><SelectCompany rows={data.companies}/><Field label="复盘标题" name="title"/><label className="field"><span>结果</span><select name="outcome"><option>符合预期</option><option>部分符合</option><option>证伪</option><option>仍待观察</option></select></label><Field label="相对基准超额 %" name="excessReturn" type="number" defaultValue="0"/><label className="field wide"><span>经验与应修改的假设</span><textarea name="lessons" required/></label><button className="primary wide">写入复盘账</button></form></article><article className="panel note"><span className="eyebrow">基准纪律</span><h2>“超额”必须有参照物</h2><p>个股默认相对中证800行业指数；主题 ETF 默认相对中证800或约定宽基。建仓时冻结基准，复盘时不得更换。</p></article></div>
      <div className="timeline">{data.reviews.map(r=><article key={r.id}><i/><div><span>{r.created_at} · {r.company_name}</span><h3>{r.title}</h3><p>{r.lessons}</p></div><strong className={r.excess_return>=0?"good":"bad"}>{r.excess_return>0?"+":""}{r.excess_return}%</strong></article>)}</div>
    </section>}
    <footer className="site-footer">研究辅助系统，不构成投资建议 · 自动模型处于 SHADOW 阶段 · 实盘动作需人工复核</footer>
  </main>;
}

function PageHead({k,title,desc}:{k:string;title:string;desc:string}) { return <div className="pagehead"><span>{k}</span><h1>{title}</h1><p>{desc}</p></div> }
