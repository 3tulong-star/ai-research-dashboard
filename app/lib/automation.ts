import { collectAnnouncements } from "./announcements";
import { diversified } from "./automation-rules";
import { decide } from "./decision";
import { runMarketDiscovery } from "./discovery";
import { collectFinancialSnapshot } from "./financials";

type DB=D1Database;
const SOURCE_VERSION="AUTO-RESEARCH-0.1";

async function chunks(db:DB, statements:D1PreparedStatement[], size=50) {
  for(let i=0;i<statements.length;i+=size) await db.batch(statements.slice(i,i+size));
}

async function exception(db:DB,runId:number,companyId:number|null,stage:string,message:string,retryable=true) {
  await db.prepare("INSERT INTO automation_exceptions (run_id,company_id,stage,severity,message,retryable) VALUES (?,?,?,?,?,?)").bind(runId,companyId,stage,retryable?"警告":"错误",message,retryable?1:0).run();
}

export async function runFullAutomation(db:DB,trigger="SCHEDULED") {
  const now=new Date(); const stale=new Date(now.getTime()-45*60000).toISOString();
  await db.prepare("DELETE FROM automation_locks WHERE acquired_at<?").bind(stale).run();
  const lock=await db.prepare("INSERT OR IGNORE INTO automation_locks (lock_key,acquired_at) VALUES ('FULL_PIPELINE',?)").bind(now.toISOString()).run();
  if(!lock.meta.changes) return {status:"ALREADY_RUNNING"};
  const inserted=await db.prepare("INSERT INTO automation_runs (trigger,status,stage,started_at,model_version) VALUES (?,'RUNNING','DISCOVERY',?,?)").bind(trigger,now.toISOString(),SOURCE_VERSION).run();
  const runId=Number(inserted.meta.last_row_id);
  let discoveryRunId=0,promoted=0,financials=0,evidence=0,snapshots=0,decisions=0;
  try {
    const discoveryInsert=await db.prepare("INSERT INTO discovery_runs (status,source_version) VALUES ('RUNNING','a-stock-data@3.4.0-adapter.1')").run();
    discoveryRunId=Number(discoveryInsert.meta.last_row_id);
    await db.prepare("UPDATE automation_runs SET discovery_run_id=? WHERE id=?").bind(discoveryRunId,runId).run();
    const result=await runMarketDiscovery();
    const candidateInserts=result.candidates.map((c,index)=>db.prepare(`INSERT INTO discovery_candidates (run_id,rank,code,name,primary_chain,themes_json,price,pe,pb,market_cap,turnover_amount,change_60d,change_ytd,theme_score,industry_fit_score,liquidity_score,scale_score,valuation_score,momentum_score,breadth_score,risk_score,total_score,pool,reasons_json,vetoes_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(discoveryRunId,index+1,c.code,c.name,c.primaryChain,JSON.stringify(c.themes),c.price,c.pe,c.pb,c.marketCap,c.amount,c.change60,c.changeYtd,c.themeScore,c.industryFitScore,c.liquidityScore,c.scaleScore,c.valuationScore,c.momentumScore,c.breadthScore,c.riskScore,c.total,c.pool,JSON.stringify(c.reasons),JSON.stringify(c.vetoes)));
    await chunks(db,candidateInserts);
    await db.batch([
      db.prepare("UPDATE discovery_runs SET status='SUCCESS',as_of=?,universe_count=?,board_count=?,scanned_count=?,candidate_count=?,source_version=?,raw_hash=? WHERE id=?").bind(result.asOf,result.marketUniverseCount,result.matchedBoards.length,result.scannedCount,result.candidates.filter(c=>c.pool==='深度研究池'||c.pool==='AI候选池').length,result.sourceVersion,result.rawHash,discoveryRunId),
      db.prepare("INSERT INTO source_logs (run_id,source,endpoint,retrieved_at,status,row_count,raw_hash) VALUES (?,?,?,?,?,?,?)").bind(discoveryRunId,"Eastmoney via a-stock-data adapter","push2.eastmoney.com/api/qt/clist/get",result.retrievedAt,"SUCCESS",result.scannedCount,result.rawHash),
      db.prepare("UPDATE automation_runs SET stage='PROMOTION',discovery_run_id=? WHERE id=?").bind(discoveryRunId,runId),
    ]);

    for(const c of diversified(result.candidates)) {
      const suffix=c.code.startsWith("6")?"SH":"SZ"; const ticker=`${c.code}.${suffix}`;
      await db.prepare("INSERT OR IGNORE INTO companies (ticker,name,sector,category,thesis,status) VALUES (?,?,?,?,?,?)").bind(ticker,c.name,c.primaryChain,"个股",`自动发现：${c.reasons.join("；")}`,"自动研究").run();
      const company=await db.prepare("SELECT id FROM companies WHERE ticker=?").bind(ticker).first<{id:number}>(); const companyId=Number(company?.id);
      promoted++;
      const discoveryTitle=`自动发现线索 · 扫描批次 ${discoveryRunId}`;
      await db.prepare("INSERT INTO evidence (company_id,title,source_url,source_grade,published_at,evidence_type,stance,notes) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM evidence WHERE company_id=? AND title=?)").bind(companyId,discoveryTitle,`https://quote.eastmoney.com/${c.code}.html`,"C · 数据适配器线索",result.asOf,"发现线索","中性",c.reasons.join("；"),companyId,discoveryTitle).run();
      evidence++;
      try {
        const f=await collectFinancialSnapshot(c.code,c);
        await db.prepare(`INSERT INTO financial_records (run_id,company_id,period,source,revenue,revenue_growth,net_profit,net_profit_growth,assets,liabilities,inventory,cfo,raw_hash,data_complete) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).bind(runId,companyId,f.period,"新浪财经原始报表接口",f.revenue,f.revenueGrowth,f.netProfit,f.netProfitGrowth,f.assets,f.liabilities,f.inventory,f.cfo,f.rawHash).run(); financials++;
        const snapshot=await db.prepare(`INSERT INTO snapshots (company_id,period,revenue_growth,margin_trend,cfo_quality,inventory_gap,debt_ratio,industry_score,moat_score,catalyst_score,positive_probability,expected_excess,permanent_loss_probability,valuation_percentile,drawdown,volatility,tradable,data_complete,model_version,model_status,automation_run_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,?,?,?)`).bind(companyId,f.period,f.revenueGrowth,f.marginTrend,f.cfoQuality,f.inventoryGap,f.debtRatio,f.industryScore,f.moatScore,f.catalystScore,f.positiveProbability,f.expectedExcess,f.permanentLossProbability,f.valuationPercentile,f.drawdown,f.volatility,f.modelVersion,f.modelStatus,runId).run(); snapshots++;
        const d=decide({industryScore:f.industryScore,moatScore:f.moatScore,catalystScore:f.catalystScore,revenueGrowth:f.revenueGrowth,valuationPercentile:f.valuationPercentile,positiveProbability:f.positiveProbability,expectedExcess:f.expectedExcess,permanentLossProbability:f.permanentLossProbability,tradable:1,dataComplete:1,sector:c.primaryChain,modelStatus:f.modelStatus});
        await db.prepare("INSERT INTO decisions (company_id,snapshot_id,verdict,score,reasons_json,risk_json) VALUES (?,?,?,?,?,?)").bind(companyId,Number(snapshot.meta.last_row_id),d.verdict,d.score,JSON.stringify(d.reasons),JSON.stringify(d.risk)).run(); decisions++;
        await db.prepare("INSERT INTO source_logs (run_id,source,endpoint,retrieved_at,status,row_count,raw_hash) VALUES (?,?,?,?,?,?,?)").bind(discoveryRunId,"Sina Finance statements",f.sourceUrls.join(" | "),new Date().toISOString(),"SUCCESS",3,f.rawHash).run();
      } catch(error) { await exception(db,runId,companyId,"FINANCIALS",error instanceof Error?error.message:String(error)); }
      try {
        const a=await collectAnnouncements(c.code);
        for(const item of a.items) {
          const exists=await db.prepare("SELECT id FROM evidence WHERE company_id=? AND source_url=?").bind(companyId,item.url).first();
          if(!exists) { await db.prepare("INSERT INTO evidence (company_id,title,source_url,source_grade,published_at,evidence_type,stance,notes) VALUES (?,?,?,?,?,?,?,?)").bind(companyId,item.title,item.url,"A · 巨潮官方公告",item.publishedAt,"事实",item.stance,item.notes).run(); evidence++; }
        }
        await db.prepare("INSERT INTO source_logs (run_id,source,endpoint,retrieved_at,status,row_count) VALUES (?,?,?,?,?,?)").bind(discoveryRunId,"CNINFO official announcements",a.sourceUrl,new Date().toISOString(),"SUCCESS",a.items.length).run();
      } catch(error) { await exception(db,runId,companyId,"ANNOUNCEMENTS",error instanceof Error?error.message:String(error)); }
    }
    const exceptionCount=await db.prepare("SELECT COUNT(*) count FROM automation_exceptions WHERE run_id=?").bind(runId).first<{count:number}>();
    const summary={discoveryRunId,promoted,financials,evidence,snapshots,decisions,exceptions:Number(exceptionCount?.count||0)};
    await db.prepare("UPDATE automation_runs SET status='SUCCESS',stage='COMPLETE',completed_at=?,promoted_count=?,financial_count=?,evidence_count=?,snapshot_count=?,decision_count=?,exception_count=?,summary_json=? WHERE id=?").bind(new Date().toISOString(),promoted,financials,evidence,snapshots,decisions,summary.exceptions,JSON.stringify(summary),runId).run();
    console.log("automation completed",JSON.stringify({runId,trigger,...summary}));
    return {status:"SUCCESS",runId,...summary};
  } catch(error) {
    const message=error instanceof Error?error.message:String(error);
    if(discoveryRunId) await db.prepare("UPDATE discovery_runs SET status='FAILED',error=? WHERE id=? AND status='RUNNING'").bind(message,discoveryRunId).run();
    await exception(db,runId,null,"PIPELINE",message,true);
    await db.prepare("UPDATE automation_runs SET status='FAILED',stage='FAILED',completed_at=?,exception_count=1,error=? WHERE id=?").bind(new Date().toISOString(),message,runId).run();
    console.error("automation failed",JSON.stringify({runId,trigger,message}));
    throw error;
  } finally { await db.prepare("DELETE FROM automation_locks WHERE lock_key='FULL_PIPELINE'").run(); }
}
