import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull().unique(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  category: text("category").notNull().default("个股"),
  thesis: text("thesis").notNull().default(""),
  status: text("status").notNull().default("观察"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const evidence = sqliteTable("evidence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  title: text("title").notNull(),
  sourceUrl: text("source_url").notNull().default(""),
  sourceGrade: text("source_grade").notNull().default("B"),
  publishedAt: text("published_at").notNull(),
  evidenceType: text("evidence_type").notNull().default("事实"),
  stance: text("stance").notNull().default("中性"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const snapshots = sqliteTable("snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  period: text("period").notNull(),
  revenueGrowth: real("revenue_growth").notNull(),
  marginTrend: real("margin_trend").notNull(),
  cfoQuality: real("cfo_quality").notNull(),
  inventoryGap: real("inventory_gap").notNull(),
  debtRatio: real("debt_ratio").notNull(),
  industryScore: real("industry_score").notNull(),
  moatScore: real("moat_score").notNull(),
  catalystScore: real("catalyst_score").notNull(),
  positiveProbability: real("positive_probability").notNull(),
  expectedExcess: real("expected_excess").notNull(),
  permanentLossProbability: real("permanent_loss_probability").notNull(),
  valuationPercentile: real("valuation_percentile").notNull(),
  drawdown: real("drawdown").notNull(),
  volatility: real("volatility").notNull(),
  tradable: integer("tradable", { mode: "boolean" }).notNull().default(true),
  dataComplete: integer("data_complete", { mode: "boolean" }).notNull().default(true),
  modelVersion: text("model_version").notNull().default("MANUAL"),
  modelStatus: text("model_status").notNull().default("MANUAL"),
  automationRunId: integer("automation_run_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const decisions = sqliteTable("decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  snapshotId: integer("snapshot_id").notNull(),
  verdict: text("verdict").notNull(),
  score: real("score").notNull(),
  reasonsJson: text("reasons_json").notNull(),
  riskJson: text("risk_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  title: text("title").notNull(),
  outcome: text("outcome").notNull(),
  excessReturn: real("excess_return").notNull().default(0),
  lessons: text("lessons").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const discoveryRuns = sqliteTable("discovery_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull(), asOf: text("as_of").notNull().default(""),
  universeCount: integer("universe_count").notNull().default(0), boardCount: integer("board_count").notNull().default(0),
  scannedCount: integer("scanned_count").notNull().default(0), candidateCount: integer("candidate_count").notNull().default(0),
  sourceVersion: text("source_version").notNull(), rawHash: text("raw_hash").notNull().default(""),
  error: text("error").notNull().default(""), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const discoveryCandidates = sqliteTable("discovery_candidates", {
  id: integer("id").primaryKey({ autoIncrement: true }), runId: integer("run_id").notNull(), rank: integer("rank").notNull(),
  code: text("code").notNull(), name: text("name").notNull(), primaryChain: text("primary_chain").notNull(), themesJson: text("themes_json").notNull(),
  price: real("price").notNull(), pe: real("pe").notNull(), pb: real("pb").notNull(), marketCap: real("market_cap").notNull(),
  turnoverAmount: real("turnover_amount").notNull(), change60: real("change_60d").notNull(), changeYtd: real("change_ytd").notNull(),
  themeScore: real("theme_score").notNull(), valuationScore: real("valuation_score").notNull(), momentumScore: real("momentum_score").notNull(),
  industryFitScore: real("industry_fit_score").notNull().default(0), liquidityScore: real("liquidity_score").notNull().default(0),
  scaleScore: real("scale_score").notNull().default(0), breadthScore: real("breadth_score").notNull().default(0),
  riskScore: real("risk_score").notNull(), totalScore: real("total_score").notNull(), pool: text("pool").notNull(),
  reasonsJson: text("reasons_json").notNull(), vetoesJson: text("vetoes_json").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sourceLogs = sqliteTable("source_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }), runId: integer("run_id").notNull(), source: text("source").notNull(),
  endpoint: text("endpoint").notNull(), retrievedAt: text("retrieved_at").notNull(), status: text("status").notNull(),
  rowCount: integer("row_count").notNull().default(0), rawHash: text("raw_hash").notNull().default(""), error: text("error").notNull().default(""),
});

export const automationRuns = sqliteTable("automation_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }), trigger: text("trigger").notNull(), status: text("status").notNull(), stage: text("stage").notNull(),
  startedAt: text("started_at").notNull(), completedAt: text("completed_at"), discoveryRunId: integer("discovery_run_id"),
  promotedCount: integer("promoted_count").notNull().default(0), financialCount: integer("financial_count").notNull().default(0), evidenceCount: integer("evidence_count").notNull().default(0),
  snapshotCount: integer("snapshot_count").notNull().default(0), decisionCount: integer("decision_count").notNull().default(0), exceptionCount: integer("exception_count").notNull().default(0),
  modelVersion: text("model_version").notNull(), summaryJson: text("summary_json").notNull().default("{}"), error: text("error").notNull().default(""),
});

export const automationLocks = sqliteTable("automation_locks", { lockKey:text("lock_key").primaryKey(), acquiredAt:text("acquired_at").notNull() });

export const automationExceptions = sqliteTable("automation_exceptions", {
  id:integer("id").primaryKey({autoIncrement:true}), runId:integer("run_id").notNull(), companyId:integer("company_id"), stage:text("stage").notNull(), severity:text("severity").notNull(),
  message:text("message").notNull(), retryable:integer("retryable",{mode:"boolean"}).notNull().default(true), resolved:integer("resolved",{mode:"boolean"}).notNull().default(false), createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const financialRecords = sqliteTable("financial_records", {
  id:integer("id").primaryKey({autoIncrement:true}), runId:integer("run_id").notNull(), companyId:integer("company_id").notNull(), period:text("period").notNull(), source:text("source").notNull(),
  revenue:real("revenue").notNull(), revenueGrowth:real("revenue_growth").notNull(), netProfit:real("net_profit").notNull(), netProfitGrowth:real("net_profit_growth").notNull(),
  assets:real("assets").notNull(), liabilities:real("liabilities").notNull(), inventory:real("inventory").notNull(), cfo:real("cfo").notNull(), rawHash:text("raw_hash").notNull(),
  dataComplete:integer("data_complete",{mode:"boolean"}).notNull().default(true), createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
