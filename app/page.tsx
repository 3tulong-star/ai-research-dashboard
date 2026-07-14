"use client";

import { useMemo, useState, type ReactNode } from "react";
import marketSnapshot from "../data/market-snapshot.json";
import inferenceModel from "../data/ai-inference-model.json";

type Tone = "positive" | "warm" | "negative" | "neutral";
type View = "mainline" | "companies";

type Quote = {
  code: string;
  name: string;
  price: number | null;
  changePct: number | null;
  peTTM: number | null;
  pbMRQ: number | null;
  date: string | null;
};

type EvidenceDimension = {
  id: string;
  name: string;
  shortName: string;
  weight: number;
  probability: number;
  status: string;
  tone: Tone;
  question: string;
  metric: string;
  impact: string;
  evidence: string;
  confirm: string;
  falsify: string;
};

type Scenario = {
  id: string;
  label: string;
  probability: number;
  market2027: number;
  market2030: number;
  profitPool2030: number;
  description: string;
};

type CompanyEvidence = { label: string; status: string; tone: Tone };

type CompanyModel = {
  code: string;
  name: string;
  role: string;
  exposure: number;
  targetPE: number;
  evidenceScore: number;
  judgement: string;
  evidence: CompanyEvidence[];
  next: string;
};

type InferenceModel = {
  name: string;
  subtitle: string;
  asOf: string;
  horizon: string[];
  modelNote: string;
  evidenceDimensions: EvidenceDimension[];
  scenarios: Scenario[];
  companies: CompanyModel[];
};

const model = inferenceModel as InferenceModel;
const quotes = new Map<string, Quote>(marketSnapshot.quotes.map((quote) => [quote.code, quote as Quote]));

function formatBillion(value: number) {
  return `${value.toLocaleString("zh-CN")}亿`;
}

function formatPrice(quote?: Quote) {
  return quote?.price == null ? "--" : `¥${quote.price.toFixed(2)}`;
}

function formatChange(quote?: Quote) {
  if (quote?.changePct == null) return "--";
  return `${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%`;
}

function formatPE(quote?: Quote) {
  return quote?.peTTM == null ? "--" : `${quote.peTTM.toFixed(1)}x`;
}

function getPriceTone(quote: Quote | undefined, targetPE: number): Tone {
  if (!quote?.peTTM) return "neutral";
  const multiple = quote.peTTM / targetPE;
  if (multiple >= 2.5) return "negative";
  if (multiple >= 1.25) return "warm";
  return "positive";
}

function getPriceLabel(quote: Quote | undefined, targetPE: number) {
  if (!quote?.peTTM) return "估值数据待接入";
  const multiple = quote.peTTM / targetPE;
  if (multiple >= 2.5) return "严重透支";
  if (multiple >= 1.25) return "价格偏贵";
  return "接近模型门槛";
}

function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

function Metric({ label, value, note, tone = "neutral" }: { label: string; value: string; note: string; tone?: Tone }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("mainline");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(model.evidenceDimensions[0].id);
  const [selectedCompanyCode, setSelectedCompanyCode] = useState(model.companies[0].code);

  const selectedEvidence = model.evidenceDimensions.find((item) => item.id === selectedEvidenceId) ?? model.evidenceDimensions[0];
  const selectedCompany = model.companies.find((item) => item.code === selectedCompanyCode) ?? model.companies[0];
  const selectedQuote = quotes.get(selectedCompany.code);

  const weightedMarket2027 = useMemo(
    () => Math.round(model.scenarios.reduce((sum, scenario) => sum + scenario.market2027 * scenario.probability, 0) / 100),
    [],
  );
  const weightedMarket2030 = useMemo(
    () => Math.round(model.scenarios.reduce((sum, scenario) => sum + scenario.market2030 * scenario.probability, 0) / 100),
    [],
  );
  const weightedProfitPool2030 = useMemo(
    () => Math.round(model.scenarios.reduce((sum, scenario) => sum + scenario.profitPool2030 * scenario.probability, 0) / 100),
    [],
  );
  const evidenceScore = Math.round(model.evidenceDimensions.reduce((sum, item) => sum + item.weight * item.probability, 0) / 100);
  const minMarket2030 = Math.min(...model.scenarios.map((scenario) => scenario.market2030));
  const maxMarket2030 = Math.max(...model.scenarios.map((scenario) => scenario.market2030));
  const currentPE = selectedQuote?.peTTM ?? null;
  const earningsMultiple = currentPE == null ? null : currentPE / selectedCompany.targetPE;
  const impliedMarket2030 = earningsMultiple == null ? null : Math.round(weightedMarket2030 * earningsMultiple);
  const priceTone = getPriceTone(selectedQuote, selectedCompany.targetPE);

  return (
    <main className="research-shell">
      <header className="research-topbar">
        <div className="brand-lockup">
          <div className="brand-mark">AI</div>
          <div>
            <div className="brand-name">AI 产业研究台</div>
            <div className="brand-sub">EVIDENCE · MARKET · EARNINGS · PRICE</div>
          </div>
        </div>
        <div className="topbar-center"><span className="live-dot" /> 当前主线 <b>{model.name}</b></div>
        <div className="topbar-meta"><span>{marketSnapshot.source}</span><i /> <span>行情截至 {marketSnapshot.latestTradingDate ?? "待采集"}</span></div>
      </header>

      <div className="page-wrap">
        <section className="model-hero">
          <div className="hero-copy">
            <div className="eyebrow">MAINLINE MODEL / 01</div>
            <h1>{model.name}<br /><span>证据如何变成盈利？</span></h1>
            <p>{model.subtitle}。这里不把“看好主线”直接等同于“可以买股票”，而是把每条证据映射到市场规模、利润池和公司盈利的具体变量。</p>
            <div className="hero-tags"><Tag tone="positive">主线部分成立</Tag><Tag>5 个验证维度</Tag><Tag>2027E / 2030E</Tag></div>
          </div>
          <aside className="hero-model-card">
            <div className="card-kicker">CURRENT MODEL READ</div>
            <div className="model-read-title">需求和基础设施偏强，ROI 与价格仍是缺口</div>
            <div className="read-row"><span>证据加权分</span><strong>{evidenceScore}<small>/100</small></strong></div>
            <div className="score-track"><span style={{ width: `${evidenceScore}%` }} /></div>
            <div className="read-foot"><span>模型截至 {model.asOf}</span><span>仅供研究</span></div>
          </aside>
        </section>

        <section className="decision-strip">
          <Metric label="证据加权分" value={`${evidenceScore}/100`} note="不是市场规模的线性折扣" tone="warm" />
          <Metric label="2027E 市场中值" value={formatBillion(weightedMarket2027)} note={`情景区间 ${formatBillion(Math.min(...model.scenarios.map((s) => s.market2027)))}—${formatBillion(Math.max(...model.scenarios.map((s) => s.market2027)))}`} tone="positive" />
          <Metric label="2030E 市场中值" value={formatBillion(weightedMarket2030)} note={`情景区间 ${formatBillion(minMarket2030)}—${formatBillion(maxMarket2030)}`} tone="positive" />
          <Metric label="2030E 利润池中值" value={formatBillion(weightedProfitPool2030)} note="行业利润池，不是单家公司利润" tone="neutral" />
          <div className="decision-callout"><span>当前决策</span><strong>主线可跟踪，个股要看价格</strong><small>不做全产业链无差别买入</small></div>
        </section>

        <section className="model-path" aria-label="研究模型链路">
          {["需求", "商业化", "基础设施", "利润池", "公司估值"].map((item, index) => (
            <div className="path-step" key={item}><span>0{index + 1}</span><strong>{item}</strong>{index < 4 && <i>→</i>}</div>
          ))}
        </section>

        <section className="workspace-section">
          <div className="workspace-heading">
            <div><div className="eyebrow">DECISION WORKSPACE / 02</div><h2>先验证主线，再验证公司</h2></div>
            <div className="view-switch" role="tablist" aria-label="研究视图">
              <button className={view === "mainline" ? "active" : ""} onClick={() => setView("mainline")} role="tab" aria-selected={view === "mainline"}>主线验证</button>
              <button className={view === "companies" ? "active" : ""} onClick={() => setView("companies")} role="tab" aria-selected={view === "companies"}>公司验证</button>
            </div>
          </div>

          {view === "mainline" ? (
            <>
              <div className="evidence-grid">
                {model.evidenceDimensions.map((item) => (
                  <button key={item.id} className={`evidence-card ${selectedEvidence.id === item.id ? "selected" : ""}`} onClick={() => setSelectedEvidenceId(item.id)}>
                    <div className="evidence-card-top"><span>{item.id}</span><Tag tone={item.tone}>{item.status}</Tag></div>
                    <h3>{item.name}</h3>
                    <div className="evidence-score-line"><strong>{item.probability}%</strong><span>权重 {item.weight}%</span></div>
                    <div className="mini-track"><span className={`fill-${item.tone}`} style={{ width: `${item.probability}%` }} /></div>
                    <p>{item.metric}</p>
                  </button>
                ))}
              </div>

              <div className="evidence-inspector">
                <div className="inspector-main">
                  <div className="inspector-kicker">{selectedEvidence.id} / SELECTED EVIDENCE</div>
                  <h3>{selectedEvidence.name}</h3>
                  <p className="inspector-question">{selectedEvidence.question}</p>
                  <div className="inspector-grid"><div><span>当前证据</span><p>{selectedEvidence.evidence}</p></div><div><span>模型影响</span><p className="impact-text">{selectedEvidence.impact}</p></div></div>
                </div>
                <div className="thresholds">
                  <div className="threshold confirm"><span>证实条件</span><p>{selectedEvidence.confirm}</p></div>
                  <div className="threshold falsify"><span>证伪条件</span><p>{selectedEvidence.falsify}</p></div>
                </div>
              </div>

              <div className="quant-grid">
                <section className="panel scenario-panel">
                  <div className="panel-heading"><div><div className="eyebrow">SCENARIO MODEL / 03</div><h3>市场规模与利润池</h3></div><span className="unit-note">单位：亿元 / 年度</span></div>
                  <div className="scenario-table">
                    <div className="scenario-row scenario-head"><span>情景</span><span>概率</span><span>2027E 市场</span><span>2030E 市场</span><span>2030E 利润池</span></div>
                    {model.scenarios.map((scenario) => <div className={`scenario-row scenario-${scenario.id}`} key={scenario.id}><span><b>{scenario.label}</b><small>{scenario.description}</small></span><strong>{scenario.probability}%</strong><span>{formatBillion(scenario.market2027)}</span><span>{formatBillion(scenario.market2030)}</span><span>{formatBillion(scenario.profitPool2030)}</span></div>)}
                    <div className="scenario-row weighted-row"><span><b>证据加权中值</b><small>不是 3/5 直接折算，而是情景概率加权</small></span><strong>100%</strong><span>{formatBillion(weightedMarket2027)}</span><span>{formatBillion(weightedMarket2030)}</span><span>{formatBillion(weightedProfitPool2030)}</span></div>
                  </div>
                </section>
                <aside className="panel decision-panel">
                  <div className="eyebrow">DECISION NOTE / 04</div>
                  <h3>主线成立，不等于所有公司都值得买。</h3>
                  <p>当前模型对需求和瓶颈给出较高概率，但 ROI 和价格竞争仍压制利润池。配置顺序应当是：</p>
                  <ol><li><b>先看</b>能把推理需求变成订单和现金流的环节；</li><li><b>再看</b>公司估值要求的市场规模是否超过乐观情景；</li><li><b>最后看</b>Serenity 的瓶颈、弹性和安全边际。</li></ol>
                  <div className="decision-rule"><span>触发条件</span><strong>证据改善 + 价格低于证据中值</strong></div>
                </aside>
              </div>
            </>
          ) : (
            <div className="company-workspace">
              <div className="company-table-panel panel">
                <div className="panel-heading"><div><div className="eyebrow">COMPANY BRIDGE / 05</div><h3>主线相关公司</h3></div><span className="unit-note">价格数据自动更新；盈利参数为模型输入</span></div>
                <div className="company-table-head"><span>公司 / 角色</span><span>现价</span><span>PE / 门槛</span><span>证据分</span><span>价格要求规模</span><span>判断</span></div>
                {model.companies.map((company) => {
                  const quote = quotes.get(company.code);
                  const multiple = quote?.peTTM == null ? null : quote.peTTM / company.targetPE;
                  const implied = multiple == null ? null : Math.round(weightedMarket2030 * multiple);
                  const tone = getPriceTone(quote, company.targetPE);
                  return <button key={company.code} className={`company-table-row ${selectedCompany.code === company.code ? "selected" : ""}`} onClick={() => setSelectedCompanyCode(company.code)}>
                    <span className="company-identity"><b>{company.name}</b><small>{company.code} · {company.role}</small><em>推理暴露 {company.exposure}%</em></span>
                    <span className="quote-cell"><b>{formatPrice(quote)}</b><small className={quote?.changePct && quote.changePct >= 0 ? "up" : "down"}>{formatChange(quote)}</small></span>
                    <span className="pe-cell"><b>{formatPE(quote)}</b><small>门槛 {company.targetPE}x</small></span>
                    <span className="score-cell"><b>{company.evidenceScore}</b><small>/100</small></span>
                    <span className="implied-cell"><b>{implied == null ? "待接入" : formatBillion(implied)}</b><small>基准中值 × PE倍数</small></span>
                    <span><Tag tone={tone}>{getPriceLabel(quote, company.targetPE)}</Tag></span>
                  </button>;
                })}
                <div className="table-footnote">价格要求规模是 PE 代理模型：2030E 证据中值 ×（当前 PE ÷ 目标 PE）。它不替代总股本、分部收入、净利率和 DCF，当前只用于快速发现估值透支。</div>
              </div>

              <aside className="company-inspector panel">
                <div className="inspector-kicker">COMPANY MODEL / {selectedCompany.code}</div>
                <div className="company-title-row"><div><h3>{selectedCompany.name}</h3><span>{selectedCompany.role}</span></div><Tag tone={priceTone}>{getPriceLabel(selectedQuote, selectedCompany.targetPE)}</Tag></div>
                <p className="company-judgement">{selectedCompany.judgement}</p>
                <div className="company-metrics"><div><span>当前价格</span><strong>{formatPrice(selectedQuote)}</strong></div><div><span>当前 PE</span><strong>{formatPE(selectedQuote)}</strong></div><div><span>证据分</span><strong>{selectedCompany.evidenceScore}<small>/100</small></strong></div></div>
                <div className="earnings-bridge"><div className="bridge-title"><span>盈利桥</span><small>当前仍缺总股本 / 分部收入</small></div><div className="bridge-flow"><span>2030E 市场<br /><b>{formatBillion(weightedMarket2030)}</b></span><i>×</i><span>公司暴露<br /><b>{selectedCompany.exposure}%</b></span><i>→</i><span>公司收入<br /><b>待验证</b></span><i>→</i><span>净利润<br /><b>待验证</b></span></div></div>
                <div className="price-reverse"><div className="reverse-heading"><span>价格反推</span><Tag tone="warm">简化代理</Tag></div><div className="reverse-main"><strong>{impliedMarket2030 == null ? "待接入 PE" : formatBillion(impliedMarket2030)}</strong><span>价格隐含的 2030E 主线规模</span></div><div className="reverse-compare"><span>证据情景区间</span><b>{formatBillion(minMarket2030)}—{formatBillion(maxMarket2030)}</b><em>{impliedMarket2030 != null && impliedMarket2030 > maxMarket2030 ? "高于乐观情景" : "尚未超过乐观情景"}</em></div></div>
                <div className="company-evidence"><div className="bridge-title"><span>公司证据汇总</span><small>下一步：{selectedCompany.next}</small></div>{selectedCompany.evidence.map((item) => <div className="company-evidence-row" key={item.label}><span className={`evidence-dot dot-${item.tone}`} /><b>{item.label}</b><Tag tone={item.tone}>{item.status}</Tag></div>)}</div>
              </aside>
            </div>
          )}
        </section>

        <section className="research-rules">
          <div><div className="eyebrow">MODEL RULES / 06</div><h2>每条新信息都必须改变一个变量</h2><p>{model.modelNote}</p></div>
          <div className="rule-grid"><div><span>市场规模</span><strong>需求 × 单价</strong><small>先做场景区间，再做概率加权</small></div><div><span>公司盈利</span><strong>相关市场 × 暴露 × 份额 × 利润率</strong><small>行业规模不能直接等于公司收入</small></div><div><span>投资动作</span><strong>证据概率 × 弹性 × 安全边际</strong><small>主线好但价格贵，结论仍可是不买</small></div></div>
        </section>
      </div>

      <footer className="research-footer"><span><b>AI 产业研究台</b> · 主线验证 → 市场规模 → 公司盈利 → 估值反推</span><span>研究模型 · 非个性化投资建议</span></footer>
    </main>
  );
}
