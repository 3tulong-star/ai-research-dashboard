import { env } from "cloudflare:workers";
import { decide } from "../../lib/decision";
import { runMarketDiscovery } from "../../lib/discovery";
import { runFullAutomation } from "../../lib/automation";
import staticWorkspace from "../../../data/static-workspace.json";
import { loadRemoteWorkspace } from "../../lib/remote-workspace";

const schema = [
  `CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, ticker TEXT NOT NULL UNIQUE, name TEXT NOT NULL, sector TEXT NOT NULL, category TEXT NOT NULL DEFAULT '个股', thesis TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '观察', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS evidence (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, title TEXT NOT NULL, source_url TEXT NOT NULL DEFAULT '', source_grade TEXT NOT NULL DEFAULT 'B', published_at TEXT NOT NULL, evidence_type TEXT NOT NULL DEFAULT '事实', stance TEXT NOT NULL DEFAULT '中性', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, period TEXT NOT NULL, revenue_growth REAL NOT NULL, margin_trend REAL NOT NULL, cfo_quality REAL NOT NULL, inventory_gap REAL NOT NULL, debt_ratio REAL NOT NULL, industry_score REAL NOT NULL, moat_score REAL NOT NULL, catalyst_score REAL NOT NULL, positive_probability REAL NOT NULL, expected_excess REAL NOT NULL, permanent_loss_probability REAL NOT NULL, valuation_percentile REAL NOT NULL, drawdown REAL NOT NULL, volatility REAL NOT NULL, tradable INTEGER NOT NULL DEFAULT 1, data_complete INTEGER NOT NULL DEFAULT 1, model_version TEXT NOT NULL DEFAULT 'MANUAL', model_status TEXT NOT NULL DEFAULT 'MANUAL', automation_run_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS decisions (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, snapshot_id INTEGER NOT NULL, verdict TEXT NOT NULL, score REAL NOT NULL, reasons_json TEXT NOT NULL, risk_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, title TEXT NOT NULL, outcome TEXT NOT NULL, excess_return REAL NOT NULL DEFAULT 0, lessons TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS discovery_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL, as_of TEXT NOT NULL DEFAULT '', universe_count INTEGER NOT NULL DEFAULT 0, board_count INTEGER NOT NULL DEFAULT 0, scanned_count INTEGER NOT NULL DEFAULT 0, candidate_count INTEGER NOT NULL DEFAULT 0, source_version TEXT NOT NULL, raw_hash TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS discovery_candidates (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, rank INTEGER NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, primary_chain TEXT NOT NULL, themes_json TEXT NOT NULL, price REAL NOT NULL, pe REAL NOT NULL, pb REAL NOT NULL, market_cap REAL NOT NULL, turnover_amount REAL NOT NULL, change_60d REAL NOT NULL, change_ytd REAL NOT NULL, theme_score REAL NOT NULL, industry_fit_score REAL NOT NULL DEFAULT 0, liquidity_score REAL NOT NULL DEFAULT 0, scale_score REAL NOT NULL DEFAULT 0, valuation_score REAL NOT NULL, momentum_score REAL NOT NULL, breadth_score REAL NOT NULL DEFAULT 0, risk_score REAL NOT NULL, total_score REAL NOT NULL, pool TEXT NOT NULL, reasons_json TEXT NOT NULL, vetoes_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS source_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, source TEXT NOT NULL, endpoint TEXT NOT NULL, retrieved_at TEXT NOT NULL, status TEXT NOT NULL, row_count INTEGER NOT NULL DEFAULT 0, raw_hash TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS automation_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, trigger TEXT NOT NULL, status TEXT NOT NULL, stage TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, discovery_run_id INTEGER, promoted_count INTEGER NOT NULL DEFAULT 0, financial_count INTEGER NOT NULL DEFAULT 0, evidence_count INTEGER NOT NULL DEFAULT 0, snapshot_count INTEGER NOT NULL DEFAULT 0, decision_count INTEGER NOT NULL DEFAULT 0, exception_count INTEGER NOT NULL DEFAULT 0, model_version TEXT NOT NULL, summary_json TEXT NOT NULL DEFAULT '{}', error TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS automation_locks (lock_key TEXT PRIMARY KEY, acquired_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS automation_exceptions (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, company_id INTEGER, stage TEXT NOT NULL, severity TEXT NOT NULL, message TEXT NOT NULL, retryable INTEGER NOT NULL DEFAULT 1, resolved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS financial_records (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, company_id INTEGER NOT NULL, period TEXT NOT NULL, source TEXT NOT NULL, revenue REAL NOT NULL, revenue_growth REAL NOT NULL, net_profit REAL NOT NULL, net_profit_growth REAL NOT NULL, assets REAL NOT NULL, liabilities REAL NOT NULL, inventory REAL NOT NULL, cfo REAL NOT NULL, raw_hash TEXT NOT NULL, data_complete INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
];

const columnMigrations = [
  "ALTER TABLE snapshots ADD COLUMN model_version TEXT NOT NULL DEFAULT 'MANUAL'",
  "ALTER TABLE snapshots ADD COLUMN model_status TEXT NOT NULL DEFAULT 'MANUAL'",
  "ALTER TABLE snapshots ADD COLUMN automation_run_id INTEGER",
  "ALTER TABLE discovery_candidates ADD COLUMN industry_fit_score REAL NOT NULL DEFAULT 0",
  "ALTER TABLE discovery_candidates ADD COLUMN liquidity_score REAL NOT NULL DEFAULT 0",
  "ALTER TABLE discovery_candidates ADD COLUMN scale_score REAL NOT NULL DEFAULT 0",
  "ALTER TABLE discovery_candidates ADD COLUMN breadth_score REAL NOT NULL DEFAULT 0",
];

const seeds = [
  ["603986.SH", "兆易创新", "电子", "个股", "存储与MCU周期复苏，验证盈利兑现与估值消化", "重点研究"],
  ["300502.SZ", "新易盛", "电子", "个股", "AI算力带动高速光模块需求，重点监控客户集中与估值", "重点研究"],
  ["688008.SH", "澜起科技", "电子", "个股", "内存接口与AI互连受益，验证新产品放量节奏", "重点研究"],
  ["562500.SH", "机器人ETF", "机器人", "ETF", "长期产业趋势仓，采用分批建仓和组合风险预算", "观察"],
];

async function initialize() {
  if (!env.DB) throw new Error("D1 binding DB unavailable");
  await env.DB.batch(schema.map((sql) => env.DB.prepare(sql)));
  for(const sql of columnMigrations) { try { await env.DB.prepare(sql).run(); } catch(error) { if(!String(error).includes("duplicate column")) throw error; } }
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM companies").first<{ count: number }>();
  if (!count?.count) {
    await env.DB.batch(seeds.map((r) => env.DB.prepare("INSERT INTO companies (ticker,name,sector,category,thesis,status) VALUES (?,?,?,?,?,?)").bind(...r)));
  }
}

async function state() {
  await initialize();
  const [companies, evidence, snapshots, decisions, reviews, discoveryRuns, discoveryCandidates, discoveryRisks, sourceLogs, automationRuns, automationExceptions] = await Promise.all([
    env.DB.prepare("SELECT * FROM companies ORDER BY id").all(),
    env.DB.prepare("SELECT e.*, c.name AS company_name, c.ticker FROM evidence e JOIN companies c ON c.id=e.company_id ORDER BY e.id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT s.*, c.name AS company_name, c.ticker FROM snapshots s JOIN companies c ON c.id=s.company_id ORDER BY s.id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT d.*, c.name AS company_name, c.ticker FROM decisions d JOIN companies c ON c.id=d.company_id ORDER BY d.id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT r.*, c.name AS company_name, c.ticker FROM reviews r JOIN companies c ON c.id=r.company_id ORDER BY r.id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT * FROM discovery_runs ORDER BY id DESC LIMIT 20").all(),
    env.DB.prepare("SELECT * FROM discovery_candidates WHERE run_id=(SELECT MAX(id) FROM discovery_runs WHERE status='SUCCESS') AND pool!='风险淘汰池' ORDER BY rank LIMIT 120").all(),
    env.DB.prepare("SELECT * FROM discovery_candidates WHERE run_id=(SELECT MAX(id) FROM discovery_runs WHERE status='SUCCESS') AND pool='风险淘汰池' ORDER BY rank LIMIT 30").all(),
    env.DB.prepare("SELECT * FROM source_logs ORDER BY id DESC LIMIT 20").all(),
    env.DB.prepare("SELECT * FROM automation_runs ORDER BY id DESC LIMIT 20").all(),
    env.DB.prepare("SELECT x.*,c.name AS company_name,c.ticker FROM automation_exceptions x LEFT JOIN companies c ON c.id=x.company_id WHERE x.resolved=0 ORDER BY x.id DESC LIMIT 100").all(),
  ]);
  const remote = await loadRemoteWorkspace((env as unknown as { RESEARCH_PRIVATE_KEY?: string }).RESEARCH_PRIVATE_KEY);
  const generated = (remote ?? staticWorkspace) as Record<string, unknown>;
  const staticCompanies = (generated.companies as Record<string, unknown>[] | undefined) ?? [];
  const storedCompanies = companies.results as Record<string, unknown>[];
  const idMap = new Map<number, number>();
  for (const company of staticCompanies) {
    const stored = storedCompanies.find((row) => row.ticker === company.ticker);
    idMap.set(Number(company.id), Number(stored?.id ?? company.id));
  }
  const remap = (rows: Record<string, unknown>[]) => rows.map((row) => ({ ...row, company_id: row.company_id == null ? row.company_id : idMap.get(Number(row.company_id)) ?? row.company_id }));
  const mergedCompanies = [...storedCompanies, ...staticCompanies.filter((row) => !storedCompanies.some((stored) => stored.ticker === row.ticker))];
  const preferStatic = <T,>(key: string, fallback: T[]) => {
    const rows = (generated[key] as T[] | undefined) ?? [];
    return rows.length ? rows : fallback;
  };
  return {
    companies: mergedCompanies,
    evidence: [...remap(preferStatic("evidence", []) as Record<string, unknown>[]), ...evidence.results],
    snapshots: [...remap(preferStatic("snapshots", []) as Record<string, unknown>[]), ...snapshots.results],
    decisions: [...remap(preferStatic("decisions", []) as Record<string, unknown>[]), ...decisions.results],
    reviews: reviews.results,
    discoveryRuns: preferStatic("discoveryRuns", discoveryRuns.results),
    discoveryCandidates: preferStatic("discoveryCandidates", [...discoveryCandidates.results,...discoveryRisks.results]),
    sourceLogs: preferStatic("sourceLogs", sourceLogs.results),
    automationRuns: preferStatic("automationRuns", automationRuns.results),
    automationExceptions: preferStatic("automationExceptions", automationExceptions.results),
  };
}

async function batch(statements: D1PreparedStatement[], size=60) {
  for(let i=0;i<statements.length;i+=size) await env.DB.batch(statements.slice(i,i+size));
}

function num(data: Record<string, unknown>, key: string) {
  const value = Number(data[key]);
  if (!Number.isFinite(value)) throw new Error(`${key} 必须是数字`);
  return value;
}

export async function GET() {
  try { return Response.json(await state()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    await initialize();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    if (action === "runAutomation") {
      await runFullAutomation(env.DB,"MANUAL_FALLBACK");
    } else if (action === "runDiscovery") {
      await env.DB.prepare("INSERT INTO discovery_runs (status,source_version) VALUES ('RUNNING','a-stock-data@3.4.0-adapter.1')").run();
      const row=await env.DB.prepare("SELECT MAX(id) AS id FROM discovery_runs").first<{id:number}>();
      const runId=Number(row?.id);
      try {
        const result=await runMarketDiscovery();
        const inserts=result.candidates.map((c,index)=>env.DB.prepare(`INSERT INTO discovery_candidates (run_id,rank,code,name,primary_chain,themes_json,price,pe,pb,market_cap,turnover_amount,change_60d,change_ytd,theme_score,valuation_score,momentum_score,risk_score,total_score,pool,reasons_json,vetoes_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(runId,index+1,c.code,c.name,c.primaryChain,JSON.stringify(c.themes),c.price,c.pe,c.pb,c.marketCap,c.amount,c.change60,c.changeYtd,c.themeScore,c.valuationScore,c.momentumScore,c.riskScore,c.total,c.pool,JSON.stringify(c.reasons),JSON.stringify(c.vetoes)));
        await batch(inserts);
        await env.DB.batch([
          env.DB.prepare("UPDATE discovery_runs SET status='SUCCESS',as_of=?,universe_count=?,board_count=?,scanned_count=?,candidate_count=?,source_version=?,raw_hash=? WHERE id=?").bind(result.asOf,result.marketUniverseCount,result.matchedBoards.length,result.scannedCount,result.candidates.filter(c=>c.pool==='深度研究池'||c.pool==='AI候选池').length,result.sourceVersion,result.rawHash,runId),
          env.DB.prepare("INSERT INTO source_logs (run_id,source,endpoint,retrieved_at,status,row_count,raw_hash) VALUES (?,?,?,?,?,?,?)").bind(runId,"Eastmoney via a-stock-data adapter","push2.eastmoney.com/api/qt/clist/get",result.retrievedAt,"SUCCESS",result.scannedCount,result.rawHash),
        ]);
      } catch(error) {
        const msg=error instanceof Error?error.message:"扫描失败";
        await env.DB.batch([
          env.DB.prepare("UPDATE discovery_runs SET status='FAILED',error=? WHERE id=?").bind(msg,runId),
          env.DB.prepare("INSERT INTO source_logs (run_id,source,endpoint,retrieved_at,status,error) VALUES (?,?,?,?,?,?)").bind(runId,"Eastmoney via a-stock-data adapter","push2.eastmoney.com/api/qt/clist/get",new Date().toISOString(),"FAILED",msg),
        ]);
        throw error;
      }
    } else if (action === "promoteCandidate") {
      const candidate=await env.DB.prepare("SELECT * FROM discovery_candidates WHERE id=?").bind(num(body,"candidateId")).first<Record<string,unknown>>();
      if(!candidate) throw new Error("找不到候选标的");
      if(String(candidate.pool)==="风险淘汰池") throw new Error("风险淘汰标的不能进入研究池");
      const code=String(candidate.code); const suffix=code.startsWith("6")?"SH":"SZ"; const ticker=`${code}.${suffix}`;
      await env.DB.prepare("INSERT OR IGNORE INTO companies (ticker,name,sector,category,thesis,status) VALUES (?,?,?,?,?,?)").bind(ticker,String(candidate.name),String(candidate.primary_chain),"个股",`自动发现：${String(candidate.reasons_json)}`,"待研究").run();
      const company=await env.DB.prepare("SELECT id FROM companies WHERE ticker=?").bind(ticker).first<{id:number}>();
      const title=`自动发现线索 · 扫描批次 ${String(candidate.run_id)}`;
      const exists=await env.DB.prepare("SELECT id FROM evidence WHERE company_id=? AND title=?").bind(Number(company?.id),title).first();
      if(!exists) await env.DB.prepare("INSERT INTO evidence (company_id,title,source_url,source_grade,published_at,evidence_type,stance,notes) VALUES (?,?,?,?,?,?,?,?)").bind(Number(company?.id),title,`https://quote.eastmoney.com/${code}.html`,"C · 数据适配器线索",new Date().toISOString().slice(0,10),"发现线索","中性",String(candidate.reasons_json)).run();
    } else if (action === "addCompany") {
      await env.DB.prepare("INSERT INTO companies (ticker,name,sector,category,thesis,status) VALUES (?,?,?,?,?,?)").bind(String(body.ticker).trim(), String(body.name).trim(), String(body.sector).trim(), String(body.category || "个股"), String(body.thesis || ""), "观察").run();
    } else if (action === "addEvidence") {
      await env.DB.prepare("INSERT INTO evidence (company_id,title,source_url,source_grade,published_at,evidence_type,stance,notes) VALUES (?,?,?,?,?,?,?,?)").bind(num(body,"companyId"), String(body.title), String(body.sourceUrl || ""), String(body.sourceGrade || "B"), String(body.publishedAt), String(body.evidenceType || "事实"), String(body.stance || "中性"), String(body.notes || "")).run();
    } else if (action === "saveSnapshot") {
      const keys = ["companyId","revenueGrowth","marginTrend","cfoQuality","inventoryGap","debtRatio","industryScore","moatScore","catalystScore","positiveProbability","expectedExcess","permanentLossProbability","valuationPercentile","drawdown","volatility"];
      const v = Object.fromEntries(keys.map((k) => [k, num(body,k)]));
      await env.DB.prepare(`INSERT INTO snapshots (company_id,period,revenue_growth,margin_trend,cfo_quality,inventory_gap,debt_ratio,industry_score,moat_score,catalyst_score,positive_probability,expected_excess,permanent_loss_probability,valuation_percentile,drawdown,volatility,tradable,data_complete) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(v.companyId,String(body.period),v.revenueGrowth,v.marginTrend,v.cfoQuality,v.inventoryGap,v.debtRatio,v.industryScore,v.moatScore,v.catalystScore,v.positiveProbability,v.expectedExcess,v.permanentLossProbability,v.valuationPercentile,v.drawdown,v.volatility,body.tradable?1:0,body.dataComplete?1:0).run();
    } else if (action === "makeDecision") {
      const snapshot = await env.DB.prepare("SELECT s.*, c.sector FROM snapshots s JOIN companies c ON c.id=s.company_id WHERE s.id=?").bind(num(body,"snapshotId")).first<Record<string, unknown>>();
      if (!snapshot) throw new Error("找不到数据快照");
      const normalized = { industryScore:Number(snapshot.industry_score), moatScore:Number(snapshot.moat_score), catalystScore:Number(snapshot.catalyst_score), revenueGrowth:Number(snapshot.revenue_growth), valuationPercentile:Number(snapshot.valuation_percentile), positiveProbability:Number(snapshot.positive_probability), expectedExcess:Number(snapshot.expected_excess), permanentLossProbability:Number(snapshot.permanent_loss_probability), tradable:Number(snapshot.tradable), dataComplete:Number(snapshot.data_complete), sector:String(snapshot.sector), modelStatus:String(snapshot.model_status||"MANUAL") };
      const result = decide(normalized);
      await env.DB.prepare("INSERT INTO decisions (company_id,snapshot_id,verdict,score,reasons_json,risk_json) VALUES (?,?,?,?,?,?)").bind(Number(snapshot.company_id),Number(snapshot.id),result.verdict,result.score,JSON.stringify(result.reasons),JSON.stringify(result.risk)).run();
    } else if (action === "addReview") {
      await env.DB.prepare("INSERT INTO reviews (company_id,title,outcome,excess_return,lessons) VALUES (?,?,?,?,?)").bind(num(body,"companyId"),String(body.title),String(body.outcome),num(body,"excessReturn"),String(body.lessons || "")).run();
    } else throw new Error("未知操作");
    return Response.json(await state());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 400 });
  }
}
