export type DecisionInput = {
  industryScore: number; moatScore: number; catalystScore: number;
  revenueGrowth: number; valuationPercentile: number;
  positiveProbability: number; expectedExcess: number;
  permanentLossProbability: number; tradable: number;
  dataComplete: number; sector: string; modelStatus?: string;
};

export function decide(s: DecisionInput) {
  const reasons: string[] = [];
  const failures: string[] = [];
  if (!s.dataComplete) failures.push("关键数据不完整");
  if (!s.tradable) failures.push("可交易性否决");
  if (s.sector === "成长") failures.push("成长行业样本尚未通过验证");
  if (s.modelStatus === "SHADOW") failures.push("影子模型尚待新鲜留出集验证");
  if (s.positiveProbability < 55) failures.push("正超额概率低于55%"); else reasons.push("正超额概率达标");
  if (s.expectedExcess < 10) failures.push("预期24月超额低于10个百分点"); else reasons.push("预期超额达标");
  if (s.permanentLossProbability > 10) failures.push("永久损失概率高于10%"); else reasons.push("永久损失风险达标");
  const quality = (s.industryScore + s.moatScore + s.catalystScore + Math.min(100, Math.max(0, 50 + s.revenueGrowth))) / 4;
  const valuation = 100 - s.valuationPercentile;
  const score = Math.round((quality * 0.4 + valuation * 0.2 + s.positiveProbability * 0.25 + Math.max(0, 100 - s.permanentLossProbability * 5) * 0.15) * 10) / 10;
  const verdict = failures.some((x) => x.includes("否决")) ? "拒绝" : failures.length ? "继续研究" : "进入组合候选";
  return { verdict, score, reasons: [...reasons, ...failures], risk: { initialPositionPct: verdict === "进入组合候选" ? Math.min(5, Math.max(1, Math.round((10 - s.permanentLossProbability / 2) * 10) / 10)) : 0, reviewDrawdownPct: -15, hardStop: "基本面证伪优先，价格止损仅作风险闸门" } };
}
