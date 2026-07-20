import { writeFile } from "node:fs/promises";
import { collectAnnouncements } from "../app/lib/announcements.ts";
import { diversified } from "../app/lib/automation-rules.ts";
import { decide } from "../app/lib/decision.ts";
import { runMarketDiscovery } from "../app/lib/discovery.ts";
import { collectFinancialSnapshot } from "../app/lib/financials.ts";

const outputUrl = process.env.RESEARCH_OUTPUT
  ? new URL(`file://${process.env.RESEARCH_OUTPUT}`)
  : new URL("../data/static-workspace.json", import.meta.url);
const now = new Date();
const runId = Number(String(now.getTime()).slice(-9));
const discoveryRunId = runId;
let nextCompanyId = 100_000;
let nextEvidenceId = 200_000;
let nextSnapshotId = 300_000;
let nextDecisionId = 400_000;
let nextExceptionId = 500_000;
let nextSourceId = 600_000;

const companies: Record<string, unknown>[] = [];
const evidence: Record<string, unknown>[] = [];
const snapshots: Record<string, unknown>[] = [];
const decisions: Record<string, unknown>[] = [];
const exceptions: Record<string, unknown>[] = [];
const sourceLogs: Record<string, unknown>[] = [];

function tickerFor(code: string) {
  return `${code}.${code.startsWith("6") ? "SH" : "SZ"}`;
}

function addException(company: Record<string, unknown> | null, stage: string, error: unknown) {
  exceptions.push({
    id: nextExceptionId++, run_id: runId, company_id: company?.id ?? null,
    company_name: company?.name ?? null, ticker: company?.ticker ?? null,
    stage, severity: "警告", message: error instanceof Error ? error.message : String(error),
    retryable: 1, resolved: 0, created_at: new Date().toISOString(),
  });
}

async function main() {
  const discovery = await runMarketDiscovery();
  sourceLogs.push({
    id: nextSourceId++, run_id: discoveryRunId, source: "Eastmoney via a-stock-data adapter",
    endpoint: "push2.eastmoney.com/api/qt/clist/get", retrieved_at: discovery.retrievedAt,
    status: "SUCCESS", row_count: discovery.scannedCount, raw_hash: discovery.rawHash, error: "",
  });

  const promoted = diversified(discovery.candidates);
  for (const candidate of promoted) {
    const company = {
      id: nextCompanyId++, ticker: tickerFor(candidate.code), name: candidate.name,
      sector: candidate.primaryChain, category: "个股",
      thesis: `自动发现：${candidate.reasons.join("；")}`, status: "自动研究",
      created_at: now.toISOString(),
    };
    companies.push(company);
    evidence.push({
      id: nextEvidenceId++, company_id: company.id, company_name: company.name, ticker: company.ticker,
      title: `自动发现线索 · 扫描批次 ${discoveryRunId}`,
      source_url: `https://quote.eastmoney.com/${candidate.code}.html`,
      source_grade: "C · 数据适配器线索", published_at: discovery.asOf,
      evidence_type: "发现线索", stance: "中性", notes: candidate.reasons.join("；"),
      created_at: now.toISOString(),
    });

    try {
      const financial = await collectFinancialSnapshot(candidate.code, candidate);
      const snapshotId = nextSnapshotId++;
      snapshots.push({
        id: snapshotId, company_id: company.id, company_name: company.name, ticker: company.ticker,
        period: financial.period, revenue_growth: financial.revenueGrowth,
        margin_trend: financial.marginTrend, cfo_quality: financial.cfoQuality,
        inventory_gap: financial.inventoryGap, debt_ratio: financial.debtRatio,
        industry_score: financial.industryScore, moat_score: financial.moatScore,
        catalyst_score: financial.catalystScore, positive_probability: financial.positiveProbability,
        expected_excess: financial.expectedExcess,
        permanent_loss_probability: financial.permanentLossProbability,
        valuation_percentile: financial.valuationPercentile, drawdown: financial.drawdown,
        volatility: financial.volatility, tradable: 1, data_complete: 1,
        model_version: financial.modelVersion, model_status: financial.modelStatus,
        automation_run_id: runId, created_at: new Date().toISOString(),
      });
      const result = decide({
        industryScore: financial.industryScore, moatScore: financial.moatScore,
        catalystScore: financial.catalystScore, revenueGrowth: financial.revenueGrowth,
        valuationPercentile: financial.valuationPercentile,
        positiveProbability: financial.positiveProbability, expectedExcess: financial.expectedExcess,
        permanentLossProbability: financial.permanentLossProbability, tradable: 1,
        dataComplete: 1, sector: candidate.primaryChain, modelStatus: financial.modelStatus,
      });
      decisions.push({
        id: nextDecisionId++, company_id: company.id, snapshot_id: snapshotId,
        company_name: company.name, ticker: company.ticker, verdict: result.verdict,
        score: result.score, reasons_json: JSON.stringify(result.reasons),
        risk_json: JSON.stringify(result.risk), created_at: new Date().toISOString(),
      });
      sourceLogs.push({
        id: nextSourceId++, run_id: discoveryRunId, source: "Sina Finance statements",
        endpoint: financial.sourceUrls.join(" | "), retrieved_at: new Date().toISOString(),
        status: "SUCCESS", row_count: 3, raw_hash: financial.rawHash, error: "",
      });
    } catch (error) {
      addException(company, "FINANCIALS", error);
    }

    try {
      const announcements = await collectAnnouncements(candidate.code);
      for (const item of announcements.items) {
        evidence.push({
          id: nextEvidenceId++, company_id: company.id, company_name: company.name, ticker: company.ticker,
          title: item.title, source_url: item.url, source_grade: "A · 巨潮官方公告",
          published_at: item.publishedAt, evidence_type: "事实", stance: item.stance,
          notes: item.notes, created_at: new Date().toISOString(),
        });
      }
      sourceLogs.push({
        id: nextSourceId++, run_id: discoveryRunId, source: "CNINFO official announcements",
        endpoint: announcements.sourceUrl, retrieved_at: new Date().toISOString(),
        status: "SUCCESS", row_count: announcements.items.length, raw_hash: "", error: "",
      });
    } catch (error) {
      addException(company, "ANNOUNCEMENTS", error);
    }
  }

  const completedAt = new Date().toISOString();
  const discoveryCandidates = discovery.candidates.slice(0, 150).map((candidate, index) => ({
    id: 700_000 + index, run_id: discoveryRunId, rank: index + 1,
    code: candidate.code, name: candidate.name, primary_chain: candidate.primaryChain,
    themes_json: JSON.stringify(candidate.themes), price: candidate.price, pe: candidate.pe, pb: candidate.pb,
    market_cap: candidate.marketCap, turnover_amount: candidate.amount,
    change_60d: candidate.change60, change_ytd: candidate.changeYtd,
    theme_score: candidate.themeScore, industry_fit_score: candidate.industryFitScore,
    liquidity_score: candidate.liquidityScore, scale_score: candidate.scaleScore,
    valuation_score: candidate.valuationScore, momentum_score: candidate.momentumScore,
    breadth_score: candidate.breadthScore, risk_score: candidate.riskScore,
    total_score: candidate.total, pool: candidate.pool,
    reasons_json: JSON.stringify(candidate.reasons), vetoes_json: JSON.stringify(candidate.vetoes),
    created_at: now.toISOString(),
  }));
  const summary = {
    discoveryRunId, promoted: companies.length, financials: snapshots.length,
    evidence: evidence.length, snapshots: snapshots.length, decisions: decisions.length,
    exceptions: exceptions.length,
  };
  const workspace = {
    generatedAt: completedAt, companies, evidence, snapshots, decisions, reviews: [],
    discoveryRuns: [{
      id: discoveryRunId, status: "SUCCESS", as_of: discovery.asOf,
      universe_count: discovery.marketUniverseCount, board_count: discovery.matchedBoards.length,
      scanned_count: discovery.scannedCount,
      candidate_count: discovery.candidates.filter((candidate) => candidate.pool === "深度研究池" || candidate.pool === "AI候选池").length,
      source_version: discovery.sourceVersion, raw_hash: discovery.rawHash, error: "",
      created_at: now.toISOString(),
    }],
    discoveryCandidates, sourceLogs,
    automationRuns: [{
      id: runId, trigger: "CODEX_LOCAL_SCHEDULE", status: "SUCCESS", stage: "COMPLETE",
      started_at: now.toISOString(), completed_at: completedAt, discovery_run_id: discoveryRunId,
      promoted_count: companies.length, financial_count: snapshots.length,
      evidence_count: evidence.length, snapshot_count: snapshots.length,
      decision_count: decisions.length, exception_count: exceptions.length,
      model_version: "AUTO-RESEARCH-0.1", summary_json: JSON.stringify(summary), error: "",
    }],
    automationExceptions: exceptions,
  };
  await writeFile(outputUrl, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "SUCCESS", runId, ...summary }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
