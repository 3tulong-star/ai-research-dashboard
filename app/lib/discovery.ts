const EM_URL = "https://push2.eastmoney.com/api/qt/clist/get";
const SOURCE_VERSION = "a-stock-data@3.4.0-adapter.1";
const FALLBACK_SOURCE_VERSION = "a-stock-data@3.4.0-ths-tencent-baidu-fallback.1";

const fallbackCore:Record<string,string[]> = {
  "半导体与存储":"000725,002415,000100,300223,300184,000021,300975,688099,300398,002414,301308,688213,688396,001309,300475,001389,600460,301099,002008,603986,002409,688008,002049,603283,301536,688766,688416,300531,603893,603501,300666,300042,300236,003031,688012,601231,002643,002916,300054,688019,001287,688049,301630,688550,603005,002371,688041,002559,688181,600206,688072,688981,002975".split(","),
  "机器人":"002841,688002,001339,002444,300124,002236,300458,688400,301603,300083,002600,603236,002273,603337,002979,002472,300503,000157,301029,300602,300679,300488,603270,300607,600499,601717,002881,688777,000887,300476,002747,688686,002690,000425,002180".split(","),
  "模型与软件":"688036,688111,002432,688475,300866,688628,603629,002351,300768".split(","),
  "端侧AI":"002241,300408,300613,688378,603890,300976,300566".split(","),
  "算力基础设施":"000063,601138,600522,600487,600941,601728,600050,000977,603296,300373,002475,600563,002138,002158,000988,300857,300308,000338,002152,300738,002156,300302,002179,688525,603019,300442,300684,603228,300502,002947,301031,002185,603203,600580,600105,000811,603083,002396,002929,002130,002281,688025,300852,600415,688048,002249".split(","),
};

type Board = { code:string; name:string; change:number; up:number; down:number; chain:string; relevance:number };
type Quote = { code:string; name:string; industry:string; price:number; change:number; amount:number; turnover:number; pe:number; pb:number; marketCap:number; floatCap:number; change60:number; changeYtd:number };
type CandidateSeed = Quote & { boards:Board[] };
export type FallbackUniverseStock = { code:string; name:string; industry:string };
type DiscoveryOptions = { fallbackUniverse?:FallbackUniverseStock[] };

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

async function fetchResponse(url:string, init:RequestInit={}, retries=3) {
  let last="";
  for(let i=0;i<=retries;i++) {
    try {
      const response=await fetch(url,init);
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch(e) {
      last=e instanceof Error?e.message:String(e);
      if(i<retries) await sleep(500*(i+1)+Math.floor(Math.random()*250));
    }
  }
  throw new Error(last);
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

async function runEastmoneyDiscovery() {
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
  return {asOf:retrievedAt.slice(0,10),retrievedAt,sourceVersion:SOURCE_VERSION,sourceName:"Eastmoney via a-stock-data adapter",sourceEndpoint:"push2.eastmoney.com/api/qt/clist/get",marketUniverseCount:market.total,boardUniverseCount:boardTotal,matchedBoards:matched,scannedCount:byCode.size,candidates,sourceUrls,rawHash:await digest({retrievedAt,matched,candidates})};
}

function fallbackBoard(chain:string,name=chain,relevanceOverride?:number):Board {
  const relevance=relevanceOverride??themes.find(x=>x.chain===chain)?.relevance??68;
  return {code:`FALLBACK-${chain}`,name,change:0,up:1,down:1,chain,relevance};
}

function chainIndustry(chain:string) {
  return chain==="半导体与存储"?"半导体":chain==="机器人"?"自动化设备":chain==="模型与软件"?"软件开发":chain==="端侧AI"?"消费电子":"通信设备";
}

function broadIndustryBoard(stock:FallbackUniverseStock):Board|null {
  const label=`${stock.name} ${stock.industry}`;
  if(/半导体|集成电路|芯片|微电子|存储/.test(label)) return fallbackBoard("半导体与存储",`行业底表：${stock.industry||"半导体"}`,72);
  if(/机器人|自动化|电机|通用设备|专用设备|仪器仪表/.test(label)) return fallbackBoard("机器人",`行业底表：${stock.industry||"智能制造"}`,58);
  if(/软件|信息技术|互联网|数据服务|计算机/.test(label)) return fallbackBoard("模型与软件",`行业底表：${stock.industry||"软件与信息技术"}`,62);
  if(/通信|电子设备|电子元件|光学|消费电子/.test(label)) return fallbackBoard("算力基础设施",`行业底表：${stock.industry||"电子与通信"}`,60);
  if(/汽车|汽车零部件/.test(label)) return fallbackBoard("自动驾驶",`行业底表：${stock.industry||"汽车产业"}`,48);
  return null;
}

function prefixed(code:string) {
  return `${code.startsWith("6")?"sh":code.startsWith("8")?"bj":"sz"}${code}`;
}

async function tencentQuotes(codes:string[]) {
  const result=new Map<string,Quote>();
  for(let i=0;i<codes.length;i+=50) {
    const batch=codes.slice(i,i+50);
    const url=`https://qt.gtimg.cn/q=${batch.map(prefixed).join(",")}`;
    const response=await fetchResponse(url,{headers:{"User-Agent":"Mozilla/5.0"}});
    const text=new TextDecoder("gbk").decode(await response.arrayBuffer());
    for(const line of text.split(";")) {
      const match=line.match(/v_(?:sh|sz|bj)(\d{6})="([\s\S]*)"/); if(!match) continue;
      const code=match[1]; const v=match[2].split("~"); if(v.length<53) continue;
      result.set(code,{code,name:v[1]||code,industry:"",price:n(v[3]),change:n(v[32]),amount:n(v[37])*1e4,turnover:n(v[38]),pe:n(v[39]),pb:n(v[46]),marketCap:n(v[44])*1e8,floatCap:n(v[45])*1e8,change60:0,changeYtd:0});
    }
    if(i+50<codes.length) await sleep(180);
  }
  return result;
}

async function momentum(code:string) {
  const year=new Date().getUTCFullYear();
  const start=Math.floor(Date.UTC(year,0,1)/1000);
  const url=new URL("https://finance.pae.baidu.com/selfselect/getstockquotation");
  Object.entries({all:"1",isIndex:"false",isBk:"false",isBlock:"false",isFutures:"false",isStock:"true",newFormat:"1",group:"quotation_kline_ab",finClientType:"pc",code,start_time:String(start),ktype:"1"}).forEach(([k,v])=>url.searchParams.set(k,v));
  const response=await fetchResponse(url.toString(),{headers:{"User-Agent":"Mozilla/5.0","Accept":"application/vnd.finance-web.v1+json","Origin":"https://gushitong.baidu.com","Referer":"https://gushitong.baidu.com/"}},1);
  const json=await response.json() as {Result?:{newMarketData?:{marketData?:string}}};
  const rows=(json.Result?.newMarketData?.marketData||"").split(";").filter(Boolean).map(row=>row.split(","));
  if(!rows.length) return {change60:0,changeYtd:0};
  const latest=n(rows.at(-1)?.[3]);
  const prior60=n(rows[Math.max(0,rows.length-61)]?.[3]);
  const firstThisYear=rows.find(row=>String(row[1]||"")>=`${year}-01-01`)||rows.at(-1);
  const first=n(firstThisYear?.[3]);
  return {change60:prior60?Math.round((latest/prior60-1)*10000)/100:0,changeYtd:first?Math.round((latest/first-1)*10000)/100:0};
}

async function thsHotBoards() {
  const byCode=new Map<string,Board[]>();
  for(let offset=0;offset<6;offset++) {
    const date=new Date(Date.now()-offset*86400000).toISOString().slice(0,10);
    try {
      const response=await fetchResponse(`https://zx.10jqka.com.cn/event/api/getharden/date/${date}/orderby/date/orderway/desc/charset/GBK/`,{headers:{"User-Agent":"Mozilla/5.0"}},1);
      const json=await response.json() as {data?:Array<{code?:string;reason?:string}>};
      for(const row of json.data||[]) {
        const code=String(row.code||""); const labels=String(row.reason||"").split("+");
        const boards=labels.map(name=>{const hit=classify(name); return hit?fallbackBoard(hit.chain,name):null;}).filter((x):x is Board=>Boolean(x));
        if(code&&boards.length) byCode.set(code,boards);
      }
      if(byCode.size) break;
    } catch { /* try the previous calendar day */ }
  }
  return byCode;
}

async function runFallbackDiscovery(primaryError:unknown, fallbackUniverse:FallbackUniverseStock[] = []) {
  const retrievedAt=new Date().toISOString();
  const hot=await thsHotBoards();
  const core=new Map<string,{chain:string;boards:Board[];stock?:FallbackUniverseStock}>();
  for(const stock of fallbackUniverse) {
    const board=broadIndustryBoard(stock); if(!board) continue;
    core.set(stock.code,{chain:board.chain,boards:[board],stock});
  }
  for(const [chain,codes] of Object.entries(fallbackCore)) for(const code of codes) {
    const prior=core.get(code);
    if(prior) { prior.chain=chain; prior.boards.unshift(fallbackBoard(chain)); }
    else core.set(code,{chain,boards:[fallbackBoard(chain)]});
  }
  for(const [code,boards] of hot) {
    const prior=core.get(code);
    if(prior) prior.boards=[...prior.boards,...boards.filter(b=>!prior.boards.some(x=>x.name===b.name))];
    else core.set(code,{chain:[...boards].sort((a,b)=>b.relevance-a.relevance)[0].chain,boards});
  }
  const quotes=await tencentQuotes([...core.keys()]);
  const preliminary:CandidateSeed[]=[];
  for(const [code,meta] of core) {
    const quote=quotes.get(code); if(!quote) continue;
    preliminary.push({...quote,name:quote.name||meta.stock?.name||code,industry:meta.stock?.industry||chainIndustry(meta.chain),boards:meta.boards});
  }
  const detailLimit=fallbackUniverse.length?360:preliminary.length;
  const detailed=preliminary
    .map(seed=>({seed,score:scoreCandidate(seed).total}))
    .sort((a,b)=>b.score-a.score)
    .slice(0,detailLimit)
    .map(item=>item.seed);
  const cursor={value:0};
  const workers=Array.from({length:Math.min(4,detailed.length)},async()=>{
    while(cursor.value<detailed.length) {
      const seed=detailed[cursor.value++];
      try { Object.assign(seed,await momentum(seed.code)); } catch { /* retain neutral momentum and keep the run auditable */ }
      await sleep(80);
    }
  });
  await Promise.all(workers);
  const seeds=detailed;
  const minimum=fallbackUniverse.length?250:80;
  if(quotes.size<minimum||seeds.length<minimum) throw new Error(`备用行情覆盖不足: quotes=${quotes.size}, detailed=${seeds.length}, minimum=${minimum}；主源错误: ${primaryError instanceof Error?primaryError.message:String(primaryError)}`);
  const matched=[...new Map([...core.values()].flatMap(x=>x.boards).map(b=>[`${b.chain}:${b.name}`,b])).values()];
  const candidates=seeds.map(seed=>({...seed,...scoreCandidate(seed),themes:seed.boards.map(b=>b.name)})).sort((a,b)=>b.total-a.total);
  const sourceUrls=["https://zx.10jqka.com.cn/event/api/getharden/","https://qt.gtimg.cn/","https://finance.pae.baidu.com/selfselect/getstockquotation"];
  const sourceName=fallbackUniverse.length?"Baostock full A-share universe + THS + Tencent + Baidu fallback":"THS + Tencent + Baidu fallback via a-stock-data";
  if(fallbackUniverse.length) sourceUrls.unshift("https://www.baostock.com/");
  return {asOf:retrievedAt.slice(0,10),retrievedAt,sourceVersion:`${FALLBACK_SOURCE_VERSION}${fallbackUniverse.length?"-full-market":""}`,sourceName,sourceEndpoint:sourceUrls.join(" | "),marketUniverseCount:fallbackUniverse.length||quotes.size,boardUniverseCount:matched.length,matchedBoards:matched,scannedCount:quotes.size,candidates,sourceUrls,rawHash:await digest({retrievedAt,matched,candidates})};
}

export async function runMarketDiscovery(options:DiscoveryOptions={}) {
  if(process.env.RESEARCH_FORCE_FALLBACK==="1") return runFallbackDiscovery(new Error("forced fallback verification"),options.fallbackUniverse);
  try { return await runEastmoneyDiscovery(); }
  catch(error) { return runFallbackDiscovery(error,options.fallbackUniverse); }
}
