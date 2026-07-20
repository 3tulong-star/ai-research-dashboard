/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runFullAutomation } from "../app/lib/automation";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function shanghaiClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    weekday: value("weekday"),
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

async function dailyRunIsDue(db: D1Database, now = new Date()) {
  const clock = shanghaiClock(now);
  if (["Sat", "Sun"].includes(clock.weekday) || clock.minutes < 17 * 60 + 30) return false;
  const latest = await db.prepare("SELECT status,started_at FROM automation_runs ORDER BY id DESC LIMIT 1").first<{status:string;started_at:string}>();
  if (!latest) return true;
  const latestClock = shanghaiClock(new Date(latest.started_at));
  if (latestClock.date !== clock.date) return true;
  if (latest.status === "SUCCESS" || latest.status === "RUNNING") return false;
  return now.getTime() - new Date(latest.started_at).getTime() >= 30 * 60 * 1000;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const requestedRun = request.method === "GET" && url.searchParams.get("autorun") === "1";
    const scheduledWake = request.method === "GET" && url.pathname === "/" && await dailyRunIsDue(env.DB);
    if (requestedRun || scheduledWake) {
      const trigger = requestedRun ? "SCHEDULED_BROWSER" : "DAILY_TRAFFIC_WAKE";
      ctx.waitUntil(runFullAutomation(env.DB,trigger).catch((error)=>console.error("scheduled automation failed",error)));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runFullAutomation(env.DB,"CLOUDFLARE_CRON")
        .then((result)=>console.log("scheduled automation completed",JSON.stringify(result)))
        .catch((error)=>console.error("scheduled automation failed",error)),
    );
  },
};

export default worker;
