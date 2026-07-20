const SINA = "https://quotes.sina.cn/cn/api/openapi.php/CompanyFinanceService.getFinanceReport2022";
const clamp = (v:number,min=0,max=100)=>Math.max(min,Math.min(max,v));
const finite = (v:unknown)=>Number.isFinite(Number(v))?Number(v):0;

type Item={item_field:string;item_title:string;item_value:string|null;item_tongbi:number|string};
type Report={data:Item[]};
type Reports=Record<string,Report>;
type CandidateMetrics={pe:number;change60:number;changeYtd:number;valuationScore:number;industryFitScore:number;themeScore:number;breadthScore:number;riskScore:number;total:number};

async function digest(value:unknown) {
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  const hash=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function statement(code:string,source:"lrb"|"fzb"|"llb") {
  const market=code.startsWith("6")?"sh":"sz";
  const url=new URL(SINA);
  Object.entries({paperCode:`${market}${code}`,source,type:"0",page:"1",num:"8"}).forEach(([k,v])=>url.searchParams.set(k,v));
  const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0","Referer":"https://finance.sina.com.cn/"}});
  if(!response.ok) throw new Error(`新浪财务接口 ${source} HTTP ${response.status}`);
  const json=await response.json() as {result?:{data?:{report_list?:Reports}}};
  const reports=json.result?.data?.report_list;
  if(!reports||!Object.keys(reports).length) throw new Error(`新浪财务接口 ${source} 未返回报表`);
  return {reports,url:url.toString(),raw:json};
}

function find(report:Report|undefined,fields:string[]) {
  const item=report?.data.find(x=>fields.includes(x.item_field)||fields.includes(x.item_title));
  return {value:finite(item?.item_value),yoy:finite(item?.item_tongbi)*100};
}

const sigmoid=(x:number)=>1/(1+Math.exp(-x));
const medians={
  revenue_yoy_pct:16.0689444796,adjusted_margin:.0634430318,cfo_margin:.1118515778,inventory_gap_pct:-13.9344876945,debt_ratio_pct:40.0541114882,
  company_quality_score:3,industry_probability:.404109589,industry_probability_change:-.051582428,log_pe:3.817248313,ps_self_percentile:.375,
  relative_momentum_6m_pct:11.754108754,relative_momentum_12m_pct:8.495458769,drawdown_from_52w_high_pct:-26.250202149,volatility_6m_annualized_pct:43.414566448,
  two_quarter_positive:0,cfo_positive:1,inventory_guard:1,debt_guard:1,sector_CYCLICAL:0,sector_ELECTRONICS:0,sector_GROWTH:0,
};
const means={revenue_yoy_pct:31.0007614278,adjusted_margin:.0863739409,cfo_margin:.1144234138,inventory_gap_pct:-12.2910654841,debt_ratio_pct:41.187822147,company_quality_score:2.8173076923,industry_probability:.3966864427,industry_probability_change:-.0631405904,log_pe:3.8469303648,ps_self_percentile:.4203296703,relative_momentum_6m_pct:15.3522953112,relative_momentum_12m_pct:10.5165458685,drawdown_from_52w_high_pct:-26.3149745712,volatility_6m_annualized_pct:44.6302838675,two_quarter_positive:.3485576923,cfo_positive:.7379807693,inventory_guard:.8125,debt_guard:.9182692308,sector_CYCLICAL:.2716346154,sector_ELECTRONICS:.2475961538,sector_GROWTH:.2211538462};
const scales={revenue_yoy_pct:48.4812782641,adjusted_margin:.0899286247,cfo_margin:.2629961413,inventory_gap_pct:60.5838265999,debt_ratio_pct:19.0756012503,company_quality_score:.8493710691,industry_probability:.0674837997,industry_probability_change:.0873766287,log_pe:.7819064949,ps_self_percentile:.3398583863,relative_momentum_6m_pct:31.7168129303,relative_momentum_12m_pct:21.3685881847,drawdown_from_52w_high_pct:13.9474491396,volatility_6m_annualized_pct:14.0633000115,two_quarter_positive:.4765136173,cfo_positive:.439733047,inventory_guard:.3903123749,debt_guard:.2739541031,sector_CYCLICAL:.4448024855,sector_ELECTRONICS:.4316159154,sector_GROWTH:.4150238818};
const coefficients={
  positive:{intercept:-.1637873283,revenue_yoy_pct:-.0553895302,adjusted_margin:-.124831936,cfo_margin:-.0087510837,inventory_gap_pct:.0316300461,debt_ratio_pct:-.0071473169,company_quality_score:.0280035537,industry_probability:-.097284528,industry_probability_change:-.07632103,log_pe:.0730216537,ps_self_percentile:-.0488858631,relative_momentum_6m_pct:-.1275555262,relative_momentum_12m_pct:-.0519845306,drawdown_from_52w_high_pct:-.0203649047,volatility_6m_annualized_pct:-.1055700167,two_quarter_positive:-.0488027508,cfo_positive:-.001550919,inventory_guard:.1261839889,debt_guard:-.0055797609,sector_CYCLICAL:-.1081359154,sector_ELECTRONICS:.1210836101,sector_GROWTH:.062520338},
  loss:{intercept:-2.8305759125,revenue_yoy_pct:.3319024511,adjusted_margin:.4130943302,cfo_margin:.1183473638,inventory_gap_pct:-.1660248209,debt_ratio_pct:.1528103786,company_quality_score:-.1924575488,industry_probability:.0684248596,industry_probability_change:-.3575517934,log_pe:.0551751507,ps_self_percentile:-.0101063954,relative_momentum_6m_pct:.181266531,relative_momentum_12m_pct:-.0543640576,drawdown_from_52w_high_pct:.0001540016,volatility_6m_annualized_pct:.2586042089,two_quarter_positive:-.1007083656,cfo_positive:.1188927736,inventory_guard:-.4493097629,debt_guard:.0277824366,sector_CYCLICAL:-.0696906389,sector_ELECTRONICS:-.2037189305,sector_GROWTH:-.113474192},
  excess:{intercept:5.9086663835,revenue_yoy_pct:-1.8038489278,adjusted_margin:-1.176846539,cfo_margin:-1.4353771049,inventory_gap_pct:1.9925395999,debt_ratio_pct:-2.1657354486,company_quality_score:.0875801978,industry_probability:-.381970505,industry_probability_change:.9101996096,log_pe:2.5572688704,ps_self_percentile:.7134557519,relative_momentum_6m_pct:-4.5929877601,relative_momentum_12m_pct:-.1307453798,drawdown_from_52w_high_pct:.8329541875,volatility_6m_annualized_pct:-4.0017377561,two_quarter_positive:-2.9992142379,cfo_positive:1.4425743662,inventory_guard:3.2449427447,debt_guard:-1.4503685687,sector_CYCLICAL:-2.6953278812,sector_ELECTRONICS:6.2583120254,sector_GROWTH:1.6917317912},
};

function shadowModel(values:Record<string,number>) {
  const score=(kind:keyof typeof coefficients)=>Object.entries(coefficients[kind]).reduce((sum,[key,coef])=>key==="intercept"?sum+coef:sum+coef*(((values[key]??medians[key as keyof typeof medians])-means[key as keyof typeof means])/scales[key as keyof typeof scales]),0);
  return {positiveProbability:sigmoid(score("positive"))*100,permanentLossProbability:sigmoid(score("loss"))*100,expectedExcess:score("excess")};
}

export async function collectFinancialSnapshot(code:string,c:CandidateMetrics) {
  const [income,balance,cash]=await Promise.all([statement(code,"lrb"),statement(code,"fzb"),statement(code,"llb")]);
  const periods=Object.keys(income.reports).filter(x=>balance.reports[x]&&cash.reports[x]).sort();
  const period=periods.at(-1); if(!period) throw new Error("三张财务报表没有共同报告期");
  const revenue=find(income.reports[period],["BIZINCO","BIZTOTINCO","营业收入","营业总收入"]);
  const profit=find(income.reports[period],["PARENETP","归属于母公司所有者的净利润"]);
  const assets=find(balance.reports[period],["TOTASSET","资产总计"]);
  const liabilities=find(balance.reports[period],["TOTLIAB","负债合计"]);
  const inventory=find(balance.reports[period],["INVE","存货"]);
  const cfo=find(cash.reports[period],["MANANETR","经营活动产生的现金流量净额"]);
  if(!revenue.value||!assets.value) throw new Error("关键财务科目缺失");
  const margin=profit.value/revenue.value;
  const previousMargin=(profit.value/(1+profit.yoy/100))/(revenue.value/(1+revenue.yoy/100));
  const cfoMargin=cfo.value/revenue.value;
  const inventoryGap=inventory.yoy-revenue.yoy;
  const debtRatio=liabilities.value/assets.value*100;
  const quality=clamp((c.industryFitScore+c.riskScore+c.valuationScore)/75,1,4);
  const values:Record<string,number>={...medians,revenue_yoy_pct:revenue.yoy,adjusted_margin:margin,cfo_margin:cfoMargin,inventory_gap_pct:inventoryGap,debt_ratio_pct:debtRatio,company_quality_score:quality,industry_probability:.30+c.breadthScore/500,log_pe:Math.log(Math.max(c.pe,1)),relative_momentum_6m_pct:c.change60,relative_momentum_12m_pct:c.changeYtd,two_quarter_positive:revenue.yoy>0&&profit.yoy>0?1:0,cfo_positive:cfo.value>0?1:0,inventory_guard:inventoryGap<=15?1:0,debt_guard:debtRatio<=70?1:0,sector_ELECTRONICS:1};
  const model=shadowModel(values);
  return {
    period, revenue:revenue.value, revenueGrowth:revenue.yoy, netProfit:profit.value, netProfitGrowth:profit.yoy, assets:assets.value, liabilities:liabilities.value, inventory:inventory.value, cfo:cfo.value,
    marginTrend:(margin-previousMargin)*100,cfoQuality:clamp(50+25*((profit.value?cfo.value/profit.value:0)-1)),inventoryGap,debtRatio,
    industryScore:clamp((c.themeScore+c.breadthScore)/2),moatScore:clamp((c.industryFitScore+c.riskScore+c.total)/3),catalystScore:clamp((c.themeScore+c.breadthScore+c.change60)/3),
    positiveProbability:clamp(model.positiveProbability),expectedExcess:Math.max(-100,Math.min(100,model.expectedExcess)),permanentLossProbability:clamp(model.permanentLossProbability),valuationPercentile:clamp(100-c.valuationScore),drawdown:Math.min(0,c.change60),volatility:medians.volatility_6m_annualized_pct,
    rawHash:await digest({income:income.raw,balance:balance.raw,cash:cash.raw}),sourceUrls:[income.url,balance.url,cash.url],modelVersion:"REENTRY-0.6-MODEL-0.2",modelStatus:"SHADOW",
  };
}
