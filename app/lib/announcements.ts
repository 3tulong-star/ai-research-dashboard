const MAP_URL="https://www.cninfo.com.cn/new/data/szse_stock.json";
const QUERY_URL="https://www.cninfo.com.cn/new/hisAnnouncement/query";

type Announcement={title:string;url:string;publishedAt:string;stance:"支持"|"反对"|"中性";notes:string};

function stance(title:string):Announcement["stance"] {
  if(/减持|处罚|监管|风险提示|诉讼|亏损|终止|立案/.test(title)) return "反对";
  if(/增长|中标|合同|回购|增持|业绩预增/.test(title)) return "支持";
  return "中性";
}

export async function collectAnnouncements(code:string):Promise<{items:Announcement[];sourceUrl:string}> {
  const mapResponse=await fetch(MAP_URL,{headers:{"User-Agent":"Mozilla/5.0","Referer":"https://www.cninfo.com.cn/"}});
  if(!mapResponse.ok) throw new Error(`巨潮代码映射 HTTP ${mapResponse.status}`);
  const mapping=await mapResponse.json() as {stockList?:Array<{code:string;orgId:string}>};
  const stock=mapping.stockList?.find(x=>x.code===code);
  if(!stock) throw new Error("巨潮代码映射缺失");
  const end=new Date(); const start=new Date(end.getTime()-120*86400000);
  const fmt=(d:Date)=>d.toISOString().slice(0,10);
  const form=new URLSearchParams({pageNum:"1",pageSize:"30",column:code.startsWith("6")?"sse":"szse",tabName:"fulltext",plate:"",stock:`${code},${stock.orgId}`,searchkey:"",secid:"",category:"",trade:"",seDate:`${fmt(start)}~${fmt(end)}`,sortName:"",sortType:"",isHLtitle:"true"});
  const response=await fetch(QUERY_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","User-Agent":"Mozilla/5.0","Referer":"https://www.cninfo.com.cn/"},body:form});
  if(!response.ok) throw new Error(`巨潮公告接口 HTTP ${response.status}`);
  const json=await response.json() as {announcements?:Array<{announcementTitle:string;adjunctUrl:string;announcementTime:number}>};
  const important=/业绩|年度报告|季度报告|重大合同|中标|回购|增持|减持|解禁|监管|风险提示|投资者关系|调研/;
  const items=(json.announcements||[]).filter(x=>important.test(x.announcementTitle.replace(/<[^>]+>/g,""))).slice(0,8).map(x=>{
    const title=x.announcementTitle.replace(/<[^>]+>/g,"");
    return {title,url:`https://static.cninfo.com.cn/${x.adjunctUrl}`,publishedAt:new Date(x.announcementTime).toISOString().slice(0,10),stance:stance(title),notes:"巨潮资讯官方公告；自动关键词筛选，未做超出原文的推断。"};
  });
  return {items,sourceUrl:QUERY_URL};
}
