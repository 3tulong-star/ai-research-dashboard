const EM_URL = "https://push2.eastmoney.com/api/qt/clist/get";
const SOURCE_VERSION = "a-stock-data@3.4.0-adapter.1";

type Board = { code:string; name:string; change:number; up:number; down:number; chain:string; relevance:number };
type Quote = { code:string; name:string; industry:string; price:number; change:number; amount:number; turnover:number; pe:number; pb:number; marketCap:number; floatCap:number; change60:number; changeYtd:number };
type CandidateSeed = Quote & { boards:Board[] };

const themes = [
  { chain:"算力基础设施", relevance:100, re:/光模块|CPO|铜缆高速|液冷服务器|算力租赁|数据中心|服务器|IDC概念/ },
  { chain:"半导体与存储", relevance:96, re:/AI芯片|存储芯片|先进封装|Chiplet|HBM|半导体概念|光刻机/ },
  { chain:"机器人", relevance:96, re:/人形机器人|工业机器人|机器人概念|减速器|伺服系统|机器视觉|丝杠|灵巧手/ },
  { chain:"模型与软件", relevance:82, re:/AIGC|ChatGPT|大模型|多模态AI|智谱AI|Kimi概念|人工智能|AI智能体/ },
  { chain:"端侧AI", relevance:78, re:/AI眼镜|AI手机|AI PC|边缘计算|智能穿戴/ },
  { chain:"自动驾驶", relevance:72, re:/智能驾驶|激光雷达|车联网|无人驾驶/ },
  { chain:"AI应用", relevance:68, re:/AI制药|AI医疗|AI教育|AI营销|AI语料|AI应用/ },
];

const n=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v:number,min=0,max=100)=>Math.max(min,Math.min(max,v));
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function fetchJson(params:Record<string,string>, retries=5) {
  const url=new URL(EM_URL); Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  let last="";
  for(let i=0;i<=retries;i++) {
    try {
      const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0","Referer":"https://quote.eastmoney.com/"}});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const json=await response.json() as {data?:{total?:number;diff?:Record<string,unknown>[]|Record<string,Record<string,unknown>>}};
      const diff=json.data?.diff||[];
      const rows=Array.isArray(diff)?diff:Object.values(diff);
      return {rows,total:n(json.data?.total),url:url.toString()};
    } catch(e) {
      last=e instanceof Error?e.message:String(e);
      if(i<retries) await sleep(Math.min(12000,800*(2**i))+Math.floor(Math.random()*500));
    }
  }
  throw new Error(`东财接口失败: ${last}`);
}

function classify(name:string) {
  return themes.find(x=>x.re.test(name));
}

export function scoreCandidate(seed:CandidateSeed) {
  const primary=[...seed.boards].sort((a,b)=>b.relevance-a.relevance)[0];
  const themeScore=clamp((primary?.relevance||0)+(seed.boards.length-1)*3);
  const liquidityScore=seed.amount>=5e9?100:seed.amount>=1e9?85:seed.amount>=3e8?70:seed.amount>=1e8?55:seed.amount>=5e7?40:15;
  const scaleScore=seed.marketCap>=5e10?100:seed.marketCap>=2e10?85:seed.marketCap>=1e10?70:seed.marketCap>=5e9?55:seed.marketCap>=2e9?35:10;
  const industryFitScore=/半导体|电子|通信|计算机|软件|自动化|电机|光学光电子|元件|专用设备|通用设备|消费电子/.test(seed.industry)?95:/汽车零部件|电力设备|机械|仪器仪表|互联网|传媒|医疗|军工/.test(seed.industry)?65:30;
  let valuationScore=seed.pe<=0?12:seed.pe<=15?85:seed.pe<=35?100:seed.pe<=60?80:seed.pe<=100?55:30;
  if(seed.pb>12) valuationScore-=20; else if(seed.pb>8) valuationScore-=10;
  const m=seed.change60;
  const momentumScore=m>=-10&&m<=35?90:m>35&&m<=70?75:m>70&&m<=100?50:m>100?20:m>=-25?60:30;
  const breadthScore=seed.boards.length?seed.boards.reduce((s,b)=>s+(b.up+b.down?b.up/(b.up+b.down)*100:50),0)/seed.boards.length:50;
  let riskScore=100;
  if(seed.name.includes("ST")||seed.name.includes("退")) riskScore=0;
  if(seed.pe<=0) riskScore-=20;
  if(seed.change60>100) riskScore-=25;
  if(seed.changeYtd>150) riskScore-=20;
  if(seed.turnover>20) riskScore-=15;
  riskScore=clamp(riskScore);
  const vetoes:string[]=[];
  if(seed.name.includes("ST")||seed.name.includes("退")) vetoes.push("ST或退市风险标的");
  if(seed.price<=0) vetoes.push("无有效价格");
  if(seed.amount<5e7) vetoes.push("成交额低于5000万元");
  if(seed.marketCap<2e9) vetoes.push("总市值低于20亿元");
  const total=Math.round((themeScore*.20+industryFitScore*.20+liquidityScore*.15+scaleScore*.05+valuationScore*.15+momentumScore*.10+breadthScore*.10+riskScore*.05)*10)/10;
  const narrowCore=seed.boards.some(b=>b.relevance>=96&&(b.up+b.down)<=70);
  const pool=vetoes.length?"风险淘汰池":total>=85&&industryFitScore>=65&&(seed.boards.length>=2||narrowCore)?"深度研究池":total>=68&&industryFitScore>=45?"AI候选池":"全市场观察池";
  const reasons=[
    `主营${seed.industry||"未分类"}；命中${primary?.chain||"AI"}：${seed.boards.slice(0,3).map(b=>b.name).join("、")}`,
    `主题${Math.round(themeScore)} / 主体相关${Math.round(industryFitScore)} / 流动性${Math.round(liquidityScore)} / 估值${Math.round(valuationScore)}`,
    m>70?`60日涨幅${m.toFixed(1)}%，拥挤度偏高`:`60日涨幅${m.toFixed(1)}%，趋势未过热`,
  ];
  return {primaryChain:primary?.chain||"AI产业",themeScore,industryFitScore,liquidityScore,scaleScore,valuationScore,momentumScore,breadthScore:Math.round(breadthScore*10)/10,riskScore,total,pool,reasons,vetoes};
}

async function digest(value:unknown) {
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  const hash=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

export async function runMarketDiscovery() {
  const retrievedAt=new Date().toISOString();
  const boardPages=[] as Record<string,unknown>[];
  const sourceUrls:string[]=[];
  let boardTotal=0;
  for(let page=1;page<=5;page++) {
    const r=await fetchJson({pn:String(page),pz:"100",po:"1",np:"1",fltt:"2",invt:"2",fid:"f3",fs:"m:90+t:3",fields:"f3,f12,f14,f104,f105"});
    boardPages.push(...r.rows); sourceUrls.push(r.url); boardTotal=r.total||boardTotal;
    if(boardPages.length>=boardTotal) break;
    await sleep(180);
  }
  const matched:Board[]=boardPages.map(x=>{
    const c=classify(String(x.f14||""));
    return c?{code:String(x.f12),name:String(x.f14),change:n(x.f3),up:n(x.f104),down:n(x.f105),chain:c.chain,relevance:c.relevance}:null;
  }).filter((x):x is Board=>Boolean(x)).sort((a,b)=>b.relevance-a.relevance||Math.abs(b.change)-Math.abs(a.change)).slice(0,24);
  if(!matched.length) throw new Error("未找到AI主题板块，停止扫描以避免返回伪候选");

  const byCode=new Map<string,CandidateSeed>();
  for(let i=0;i<matched.length;i+=4) {
    const batch=matched.slice(i,i+4);
    for(const board of batch) {
      const result=await fetchJson({pn:"1",pz:"100",po:"1",np:"1",fltt:"2",invt:"2",fid:"f20",fs:`b:${board.code}`,fields:"f2,f3,f6,f8,f9,f12,f14,f20,f21,f23,f24,f25,f100"});
      sourceUrls.push(result.url);
      for(const x of result.rows) {
        const code=String(x.f12||""); if(!/^(00|30|60|68|83|87|92)/.test(code)) continue;
        const prior=byCode.get(code);
        if(prior) { if(!prior.boards.some(b=>b.code===board.code)) prior.boards.push(board); continue; }
        byCode.set(code,{code,name:String(x.f14||""),industry:String(x.f100||""),price:n(x.f2),change:n(x.f3),amount:n(x.f6),turnover:n(x.f8),pe:n(x.f9),marketCap:n(x.f20),floatCap:n(x.f21),pb:n(x.f23),change60:n(x.f24),changeYtd:n(x.f25),boards:[board]});
      }
      await sleep(220+Math.floor(Math.random()*180));
    }
    if(i+4<matched.length) await sleep(260);
  }
  const market=await fetchJson({pn:"1",pz:"1",po:"1",np:"1",fltt:"2",invt:"2",fid:"f20",fs:"m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",fields:"f12"});
  sourceUrls.push(market.url);
  const candidates=[...byCode.values()].map(seed=>({...seed,...scoreCandidate(seed),themes:seed.boards.map(b=>b.name)})).sort((a,b)=>b.total-a.total);
  return {asOf:retrievedAt.slice(0,10),retrievedAt,sourceVersion:SOURCE_VERSION,marketUniverseCount:market.total,boardUniverseCount:boardTotal,matchedBoards:matched,scannedCount:byCode.size,candidates,sourceUrls,rawHash:await digest({retrievedAt,matched,candidates})};
}
