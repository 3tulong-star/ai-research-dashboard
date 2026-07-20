import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("builds the investment research console", async () => {
  const assets = await readdir(new URL("../dist/client/assets/", import.meta.url));
  const pageAsset = assets.find((name) => name.startsWith("page-") && name.endsWith(".js"));
  assert.ok(pageAsset);
  const [pageBundle, layout, page] = await Promise.all([
    readFile(new URL(`../dist/client/assets/${pageAsset}`, import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /三本账 · AI 投资研究台/);
  assert.match(page, /AI先找标的/);
  assert.match(page, /P\(正超额\) ≥ 55%/);
  assert.match(page, /24M 超额 ≥ 10pp/);
  assert.match(page, /AI 全市场发现/);
  assert.match(page, /主营相关/);
  assert.match(page, /系统按计划自动研究/);
  assert.match(page, /只需人工处理这些异常/);
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /autorun/);
  assert.match(worker, /ctx\.waitUntil\(runFullAutomation/);
  assert.match(worker, /async scheduled/);
  assert.match(worker, /dailyRunIsDue/);
  const vite = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(vite, /30 9 \* \* 1-5/);
  assert.match(pageBundle, /三本账/);
  assert.doesNotMatch(page, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("ships persistence, migrations, and production metadata", async () => {
  const [api, decision, schema, layout, pkg, hosting] = await Promise.all([
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/decision.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(decision, /positiveProbability < 55/);
  assert.match(decision, /expectedExcess < 10/);
  assert.match(decision, /permanentLossProbability > 10/);
  assert.match(schema, /export const decisions/);
  assert.match(schema, /export const discoveryCandidates/);
  assert.match(schema, /export const automationRuns/);
  assert.match(api, /runFullAutomation/);
  assert.match(layout, /openGraph/);
  assert.doesNotMatch(pkg, /react-loading-skeleton/);
  assert.match(hosting, /"d1": ("DB"|null)/);
  await access(new URL("../drizzle/0000_sad_nightshade.sql", import.meta.url));
  await access(new URL("../drizzle/0001_dry_sister_grimm.sql", import.meta.url));
  await access(new URL("../app/api/status/route.ts", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

test("ships a real auditable scheduled research snapshot", async () => {
  const [workspaceText, generator, workspaceApi, statusApi] = await Promise.all([
    readFile(new URL("../data/static-workspace.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/run-static-automation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/status/route.ts", import.meta.url), "utf8"),
  ]);
  const workspace = JSON.parse(workspaceText);
  const encrypted = JSON.parse(await readFile(new URL("../data/research-snapshot.enc.json", import.meta.url), "utf8"));
  assert.equal(encrypted.algorithm, "RSA-OAEP-3072+AES-256-GCM");
  assert.ok(encrypted.generatedAt);
  assert.ok(encrypted.wrappedKey);
  assert.ok(encrypted.ciphertext.length > 1000);
  assert.equal(workspace.generatedAt, null);
  assert.equal(workspace.discoveryCandidates.length, 0);
  assert.doesNotMatch(JSON.stringify(encrypted), /兆易创新|新易盛|澜起科技/);
  assert.match(generator, /runMarketDiscovery/);
  assert.match(generator, /collectFinancialSnapshot/);
  assert.match(generator, /collectAnnouncements/);
  assert.match(workspaceApi, /staticWorkspace/);
  assert.match(statusApi, /staticWorkspace/);
});
