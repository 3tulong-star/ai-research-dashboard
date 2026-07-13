"use client";

import { useMemo, useState } from "react";
import marketSnapshot from "../data/market-snapshot.json";

type Status = "已兑现" | "部分验证" | "验证中" | "待验证" | "偏热";
type Sector = "算力" | "工业AI" | "物理AI" | "芯片";

type SnapshotQuote = {
  code: string;
  name: string;
  price: number | null;
  changePct: number | null;
  fiveDayChangePct: number | null;
  turnoverPct: number | null;
  peTTM: number | null;
  pbMRQ: number | null;
  date: string | null;
  status: string;
};

type Company = {
  code: string;
  name: string;
  sector: Sector;
  role: string;
  status: Status;
  move: string;
  tone: "up" | "down" | "flat";
  thesis: string;
  evidence: string;
  next: string;
  risk: string;
  valuation: string;
  quote?: SnapshotQuote;
};

const companies: Company[] = [
  {
    code: "300308",
    name: "中际旭创",
    sector: "算力",
    role: "高速光互联",
    status: "部分验证",
    move: "行情待接入",
    tone: "flat",
    thesis: "AI 集群扩容继续推动高速光模块升级，供给与客户认证决定利润弹性。",
    evidence: "已进入重点观察；订单、产品代际和产能利用率需要持续对照财报。",
    next: "客户资本开支 / 高速产品出货 / 毛利率",
    risk: "资本开支周期回落；价格竞争；技术路线切换。",
    valuation: "需要反推 2027—2030 收入与利润",
  },
  {
    code: "002837",
    name: "英维克",
    sector: "算力",
    role: "液冷与温控",
    status: "验证中",
    move: "行情待接入",
    tone: "flat",
    thesis: "算力功耗上升使散热从配套升级为基础设施瓶颈。",
    evidence: "瓶颈假设成立，但要验证 AI 数据中心收入占比和订单持续性。",
    next: "液冷订单 / 机柜渗透率 / 交付与毛利",
    risk: "客户自研；传统温控业务拖累；订单兑现慢。",
    valuation: "警惕把远期液冷收入一次性计入",
  },
  {
    code: "688017",
    name: "绿的谐波",
    sector: "物理AI",
    role: "精密减速器",
    status: "验证中",
    move: "行情待接入",
    tone: "flat",
    thesis: "机器人关节放量时，具备认证壁垒的精密传动部件有较高单机弹性。",
    evidence: "高弹性候选；需要把送样、定点和量产严格区分。",
    next: "客户定点 / 量产交付 / ASP 与良率",
    risk: "替代路线；客户压价；机器人放量低于预期。",
    valuation: "不接受只由整机远期销量支撑的估值",
  },
  {
    code: "300124",
    name: "汇川技术",
    sector: "工业AI",
    role: "运动控制与自动化",
    status: "已兑现",
    move: "行情待接入",
    tone: "flat",
    thesis: "已有工控现金流提供底盘，AI 和机器人带来增量期权。",
    evidence: "基本业务先验证，再观察 AI/机器人增量是否进入收入和利润。",
    next: "工控景气 / 新产品收入 / 机器人客户进展",
    risk: "制造业资本开支波动；AI 期权兑现慢。",
    valuation: "用核心业务估值覆盖底盘，单独给期权估值",
  },
  {
    code: "603662",
    name: "柯力传感",
    sector: "物理AI",
    role: "力传感器",
    status: "待验证",
    move: "行情待接入",
    tone: "flat",
    thesis: "灵巧操作需要力觉闭环，六维力传感器可能是具身智能的关键接口。",
    evidence: "方向弹性大，核心是客户认证、可靠性、量产良率和单机价值量。",
    next: "样机到量产 / 客户数量 / 传感器 ASP",
    risk: "路线替代；精度与可靠性不够；需求停留在样机。",
    valuation: "必须看到收入曲线再提高估值权重",
  },
  {
    code: "688256",
    name: "寒武纪",
    sector: "芯片",
    role: "国产 AI 芯片",
    status: "偏热",
    move: "行情待接入",
    tone: "flat",
    thesis: "国产算力自主化带来高弹性，但真正决定价值的是持续供货和软件生态。",
    evidence: "作为高弹性观察对象，不把政策、发布会或单一客户传闻当作兑现。",
    next: "设计导入 / 规模出货 / 软件生态与毛利",
    risk: "估值透支；产品迭代；客户集中；生态竞争。",
    valuation: "重点做反向估值，不追逐单一预期",
  },
  {
    code: "002463",
    name: "沪电股份",
    sector: "算力",
    role: "高端 PCB",
    status: "部分验证",
    move: "行情待接入",
    tone: "flat",
    thesis: "AI 服务器和高速交换机提升高层数、高速 PCB 的价值量。",
    evidence: "已有业务底盘，关注 AI 产品结构、产能和客户认证。",
    next: "AI 产品占比 / 产能爬坡 / 产品 ASP",
    risk: "周期反转；供给扩张；客户结构变化。",
    valuation: "用产品结构变化验证估值，而不是只看行业标签",
  },
];

const quoteMap = new Map<string, SnapshotQuote>(marketSnapshot.quotes.map((quote) => [quote.code, quote as SnapshotQuote]));
const liveCompanies = companies.map((company) => ({ ...company, quote: quoteMap.get(company.code) }));

function formatPrice(quote?: SnapshotQuote) {
  return quote?.price == null ? "--" : `¥${quote.price.toFixed(2)}`;
}

function formatChange(quote?: SnapshotQuote) {
  if (quote?.changePct == null) return "暂无行情";
  return `${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%`;
}

function quoteTone(quote?: SnapshotQuote) {
  if (quote?.changePct == null) return "flat";
  return quote.changePct >= 0 ? "up" : "down";
}

const hypotheses = [
  { id: "H-01", label: "AI 推理需求继续增长", chain: "AGI 算力链", progress: 72, status: "已强化", signal: "全球资本开支与推理基础设施仍是领先指标" },
  { id: "H-02", label: "电力、散热、互联成为新瓶颈", chain: "AGI 算力链", progress: 66, status: "部分验证", signal: "关注液冷、HVDC、高速互联的订单和交付" },
  { id: "H-03", label: "工业 AI 先于通用智能兑现 ROI", chain: "工业 AI", progress: 58, status: "验证中", signal: "看客户回本周期、续单和软件/硬件收入" },
  { id: "H-04", label: "机器人先在受控场景实现量产", chain: "物理 AI", progress: 44, status: "待验证", signal: "订单之外必须观察成功率、可靠性和单位经济性" },
  { id: "H-05", label: "力觉与灵巧操作提升部件价值量", chain: "物理 AI", progress: 38, status: "待验证", signal: "送样不等于量产，参数必须与成本和良率同时改善" },
  { id: "H-06", label: "国产 AI 芯片形成稳定设计导入", chain: "国产算力", progress: 49, status: "验证中", signal: "设计导入 → 批量出货 → 软件生态是完整证据链" },
];

const discoveries = [
  { name: "兆威机电", code: "003021", direction: "灵巧手 / 微型传动", tag: "Serenity 雷达", detail: "需要核验客户、单机价值量和量产节奏" },
  { name: "双环传动", code: "002472", direction: "精密传动 / 机器人", tag: "候选", detail: "关注扩产、认证和机器人收入占比" },
  { name: "奥比中光", code: "688322", direction: "3D 视觉 / 感知", tag: "候选", detail: "关注真实场景部署和持续采购" },
  { name: "麦格米特", code: "002851", direction: "电源 / 算力基础设施", tag: "待验证", detail: "关注客户结构、订单质量与毛利变化" },
];

const signalItems = [
  { type: "硬信号", title: "大额订单", desc: "正式合同、交付周期、预付款、收入确认", color: "green" },
  { type: "硬信号", title: "客户定点 / 量产", desc: "认证、批量交付、产能利用率和良率", color: "green" },
  { type: "中信号", title: "参数突破", desc: "独立验证、端到端性能、可靠性和单位成本", color: "orange" },
  { type: "中信号", title: "技术路线变化", desc: "客户 BOM、标准、产线或供应商体系发生变化", color: "orange" },
  { type: "反向信号", title: "逻辑证伪", desc: "订单取消、替代路线、库存与应收恶化", color: "red" },
];

const chainCards = [
  { name: "AGI 算力链", subtitle: "训练 · 推理 · 网络 · 电力", percent: 68, accent: "blue", companies: "中际旭创 · 英维克 · 沪电股份", status: "证据持续累积" },
  { name: "物理 AI", subtitle: "感知 · 控制 · 执行 · 场景", percent: 43, accent: "orange", companies: "绿的谐波 · 柯力传感 · 兆威机电", status: "等待量产信号" },
  { name: "工业 AI", subtitle: "自动化 · 机器视觉 · ROI", percent: 58, accent: "green", companies: "汇川技术 · 埃斯顿 · 奥比中光", status: "底盘先于期权" },
  { name: "国产算力", subtitle: "芯片 · 软件生态 · 设计导入", percent: 49, accent: "purple", companies: "寒武纪 · 海光信息 · 中科曙光", status: "高弹性高验证" },
];

function StatusPill({ status }: { status: Status | string }) {
  const tone = status.includes("兑现") || status.includes("强化") || status.includes("硬") ? "success" : status.includes("热") || status.includes("反") ? "danger" : status.includes("部分") ? "warm" : "muted";
  return <span className={`status-pill ${tone}`}>{status}</span>;
}

export default function Home() {
  const [sector, setSector] = useState<"全部" | Sector>("全部");
  const [activeCompany, setActiveCompany] = useState<Company>(liveCompanies[0]);
  const [saved, setSaved] = useState<string[]>([]);
  const [signalFilter, setSignalFilter] = useState("全部");

  const visibleCompanies = useMemo(() => sector === "全部" ? liveCompanies : liveCompanies.filter((company) => company.sector === sector), [sector]);
  const visibleSignals = useMemo(() => signalFilter === "全部" ? signalItems : signalItems.filter((item) => item.type === signalFilter), [signalFilter]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">A / I</div>
          <div>
            <div className="brand-name">AI 产业研究台</div>
            <div className="brand-sub">AGI · Physical AI · A-SHARE</div>
          </div>
        </div>
        <div className="topbar-meta">
          <span className="live-dot" />
          <span>研究快照 · 2026.07.13</span>
          <span className="meta-divider" />
          <span className="muted-copy">不做每日调仓，只更新证据</span>
        </div>
        <button className="search-button" aria-label="搜索研究内容"><span>⌕</span> 搜索</button>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow">CURRENT FOCUS / 01</div>
          <h1>把高弹性机会，<br /><span>放进证据链里。</span></h1>
          <p>固定选定池，持续观察关键假设；让大额订单、参数突破和路线落地成为可追踪的验证信号。</p>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => document.getElementById("selected")?.scrollIntoView({ behavior: "smooth" })}>查看当前选定池 <span>↗</span></button>
            <button className="text-action" onClick={() => document.getElementById("discoveries")?.scrollIntoView({ behavior: "smooth" })}>发现新机会 <span>→</span></button>
          </div>
        </div>
        <div className="hero-card">
          <div className="hero-card-header"><span>研究状态</span><StatusPill status="今日无调仓" /></div>
          <div className="hero-stat-row">
            <div><strong>07</strong><span>当前选定</span></div>
            <div><strong>06</strong><span>关键假设</span></div>
            <div><strong>04</strong><span>新发现</span></div>
          </div>
          <div className="confidence-line"><span>证据完整度</span><strong>61%</strong></div>
          <div className="progress-track"><span style={{ width: "61%" }} /></div>
          <div className="hero-card-note">今日重点：验证物理 AI 的量产信号，避免把送样和发布会当作收入兑现。</div>
          <div className="source-status"><span className="source-dot" /><span>行情源 <b>{marketSnapshot.source}</b></span><small>{marketSnapshot.latestTradingDate ? `${marketSnapshot.latestTradingDate} 收盘` : "待采集"}</small></div>
        </div>
      </section>

      <section className="alert-strip">
        <div className="alert-icon">!</div>
        <div><strong>估值纪律</strong><span>当前页面只记录研究判断；行情数据与公司公告接入后，所有“推荐状态”都必须同时通过业绩兑现和估值反推。</span></div>
        <button onClick={() => document.getElementById("valuation")?.scrollIntoView({ behavior: "smooth" })}>查看规则 <span>→</span></button>
      </section>

      <section className="section-block" id="selected">
        <div className="section-heading">
          <div><div className="eyebrow">SELECTED UNIVERSE / 01</div><h2>当前选定池</h2></div>
          <div className="section-heading-right"><span className="as-of">选定于 2026.07.13</span><span className="tiny-separator" /><span className="muted-copy">{marketSnapshot.source} · {marketSnapshot.latestTradingDate ?? "待采集"}</span></div>
        </div>
        <div className="selected-layout">
          <div className="selected-table-wrap">
            <div className="filter-row">
              {(["全部", "算力", "工业AI", "物理AI", "芯片"] as const).map((item) => <button key={item} className={`filter-chip ${sector === item ? "active" : ""}`} onClick={() => setSector(item)}>{item}</button>)}
            </div>
            <div className="company-table">
              <div className="table-head"><span>标的</span><span>产业角色</span><span>近期表现</span><span>假设状态</span><span>估值提醒</span></div>
              {visibleCompanies.map((company) => <button key={company.code} className={`company-row ${activeCompany.code === company.code ? "selected" : ""}`} onClick={() => setActiveCompany(company)}>
                <span className="company-name-cell"><b>{company.name}</b><small>{company.code}</small></span>
                <span><i className={`sector-dot ${company.sector === "算力" ? "blue" : company.sector === "物理AI" ? "orange" : company.sector === "芯片" ? "purple" : "green"}`} />{company.role}</span>
                <span className={`market-quote ${quoteTone(company.quote)}`}><b>{formatPrice(company.quote)}</b><small>{formatChange(company.quote)}</small></span>
                <span><StatusPill status={company.status} /></span>
                <span className="valuation-cell">{company.valuation}</span>
              </button>)}
            </div>
          </div>
          <aside className="company-detail">
            <div className="detail-top"><span className="detail-label">FOCUS NOTE</span><span className="detail-code">{activeCompany.code}</span></div>
            <h3>{activeCompany.name}<small>{activeCompany.role}</small></h3>
            <div className="detail-market-line"><span>行情截至 {activeCompany.quote?.date ?? "待采集"}</span><strong className={quoteTone(activeCompany.quote)}>{formatPrice(activeCompany.quote)} · {formatChange(activeCompany.quote)}</strong></div>
            <div className="detail-thesis">{activeCompany.thesis}</div>
            <div className="detail-block"><span>最新证据</span><p>{activeCompany.evidence}</p></div>
            <div className="detail-block"><span>下一验证点</span><p className="next-text">{activeCompany.next}</p></div>
            <div className="detail-block"><span>证伪风险</span><p>{activeCompany.risk}</p></div>
            <div className="detail-footer"><StatusPill status={activeCompany.status} /><span>点击左侧切换研究卡片</span></div>
          </aside>
        </div>
      </section>

      <section className="section-block muted-section" id="hypotheses">
        <div className="section-heading"><div><div className="eyebrow">HYPOTHESIS BOARD / 02</div><h2>关键假设达成情况</h2></div><span className="section-note">逻辑状态独立于股价表现</span></div>
        <div className="hypothesis-grid">
          {hypotheses.map((item) => <article className="hypothesis-card" key={item.id}>
            <div className="hypothesis-top"><span>{item.id}</span><StatusPill status={item.status} /></div>
            <h3>{item.label}</h3><small>{item.chain}</small>
            <div className="hypothesis-progress"><span style={{ width: `${item.progress}%` }} /></div>
            <div className="hypothesis-bottom"><strong>{item.progress}%</strong><p>{item.signal}</p></div>
          </article>)}
        </div>
      </section>

      <section className="section-block" id="chains">
        <div className="section-heading"><div><div className="eyebrow">CHAIN MAP / 03</div><h2>产业链温度</h2></div><span className="section-note">按产业假设，而非股票数量计分</span></div>
        <div className="chain-grid">
          {chainCards.map((card) => <article className="chain-card" key={card.name}>
            <div className="chain-card-head"><div><h3>{card.name}</h3><span>{card.subtitle}</span></div><span className={`chain-icon ${card.accent}`}>↗</span></div>
            <div className="chain-meter"><span className={card.accent} style={{ width: `${card.percent}%` }} /></div>
            <div className="chain-meta"><strong>{card.percent}%</strong><span>{card.status}</span></div>
            <p>{card.companies}</p>
          </article>)}
        </div>
      </section>

      <section className="split-section" id="signals">
        <div className="section-block signal-panel">
          <div className="section-heading compact"><div><div className="eyebrow">SIGNAL DICTIONARY / 04</div><h2>今天搜索什么</h2></div><span className="section-note">硬信号优先</span></div>
          <div className="signal-filter-row">{["全部", "硬信号", "中信号", "反向信号"].map((item) => <button key={item} className={signalFilter === item ? "active" : ""} onClick={() => setSignalFilter(item)}>{item}</button>)}</div>
          <div className="signal-list">{visibleSignals.map((item) => <div className="signal-row" key={item.title}><span className={`signal-marker ${item.color}`} /><div><div className="signal-name"><b>{item.title}</b><span>{item.type}</span></div><p>{item.desc}</p></div><span className="signal-arrow">→</span></div>)}</div>
        </div>
        <div className="section-block serenity-panel">
          <div className="section-heading compact"><div><div className="eyebrow">SERENITY RADAR / 05</div><h2>高弹性新发现</h2></div><span className="radar-live">● RADAR</span></div>
          <p className="panel-intro">瓶颈、刚需、少数供应商、长扩产周期；进入选定池前仍需独立验证。</p>
          <div className="discovery-list" id="discoveries">
            {discoveries.map((item) => <div className="discovery-row" key={item.code}>
              <div className="discovery-title"><b>{item.name}</b><small>{item.code} · {item.direction}</small></div><span className="discovery-tag">{item.tag}</span>
              <p>{item.detail}</p>
              <button className={saved.includes(item.code) ? "saved" : ""} onClick={() => setSaved((current) => current.includes(item.code) ? current.filter((code) => code !== item.code) : [...current, item.code])}>{saved.includes(item.code) ? "已加入候选" : "+ 加入候选"}</button>
            </div>)}
          </div>
        </div>
      </section>

      <section className="valuation-section" id="valuation">
        <div className="valuation-copy"><div className="eyebrow">VALUATION DISCIPLINE / 06</div><h2>逻辑越好，<br /><span>越要看价格要求什么。</span></h2><p>每个标的都要做基准、乐观、极乐观三种情景，反推当前市值隐含的收入、份额、毛利和产能。逻辑没有兑现前，估值透支就是风险。</p></div>
        <div className="valuation-grid">
          <div className="valuation-card"><span>01 / 未计入</span><strong>基本面领先价格</strong><p>证据在改善，市场尚未充分反映。</p></div>
          <div className="valuation-card current"><span>02 / 部分计入</span><strong>继续观察</strong><p>逻辑正确，但需要业绩追上预期。</p></div>
          <div className="valuation-card hot"><span>03 / 严重透支</span><strong>等待价格或业绩</strong><p>当前价格依赖极乐观情景才能成立。</p></div>
        </div>
      </section>

      <footer className="footer"><div><b>AI 产业研究台</b><span>当前选定池 · 假设跟踪 · 新机会发现</span></div><div>研究原型 · 非个性化投资建议</div></footer>
    </main>
  );
}
