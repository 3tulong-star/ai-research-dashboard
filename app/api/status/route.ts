import { env } from "cloudflare:workers";
import staticWorkspace from "../../../data/static-workspace.json";
import { loadRemoteWorkspace } from "../../lib/remote-workspace";

export async function GET() {
  try {
    const remote=await loadRemoteWorkspace((env as unknown as { RESEARCH_PRIVATE_KEY?: string }).RESEARCH_PRIVATE_KEY);
    const generated=remote??staticWorkspace;
    const generatedAutomation=(generated.automationRuns as typeof staticWorkspace.automationRuns | undefined)?.[0];
    if(generatedAutomation) {
      const exceptions=(generated.automationExceptions as typeof staticWorkspace.automationExceptions | undefined)??[];
      return Response.json({
        automation:generatedAutomation,
        discovery:(generated.discoveryRuns as typeof staticWorkspace.discoveryRuns | undefined)?.[0]??null,
        exceptions,
        generatedAt:generated.generatedAt,
        healthy:generatedAutomation.status==="SUCCESS"&&exceptions.length===0,
      });
    }
    if(!env.DB) throw new Error("D1 binding DB unavailable");
    const automation=await env.DB.prepare("SELECT * FROM automation_runs ORDER BY id DESC LIMIT 1").first<Record<string,unknown>>();
    const discovery=await env.DB.prepare("SELECT * FROM discovery_runs ORDER BY id DESC LIMIT 1").first<Record<string,unknown>>();
    const exceptions=automation?await env.DB.prepare("SELECT x.*,c.name AS company_name,c.ticker FROM automation_exceptions x LEFT JOIN companies c ON c.id=x.company_id WHERE x.run_id=? AND x.resolved=0 ORDER BY x.id").bind(Number(automation.id)).all():{results:[]};
    return Response.json({automation,discovery,exceptions:exceptions.results,healthy:Boolean(automation&&automation.status==="SUCCESS"&&exceptions.results.length===0)});
  } catch(error) { return Response.json({healthy:false,error:error instanceof Error?error.message:"status unavailable"},{status:500}); }
}
