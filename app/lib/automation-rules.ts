export type PromotionCandidate={primaryChain:string;pool:string;total:number};

export function diversified<T extends PromotionCandidate>(candidates:T[],limit=10) {
  const eligible=candidates.filter(c=>c.pool==="深度研究池");
  const groups=new Map<string,T[]>();
  for(const c of eligible) groups.set(c.primaryChain,[...(groups.get(c.primaryChain)||[]),c]);
  const picked:T[]=[];
  for(const rows of groups.values()) if(rows[0]) picked.push(rows[0]);
  for(const c of eligible) if(picked.length<limit&&!picked.includes(c)&&(picked.filter(x=>x.primaryChain===c.primaryChain).length<2)) picked.push(c);
  return picked.sort((a,b)=>b.total-a.total).slice(0,limit);
}
