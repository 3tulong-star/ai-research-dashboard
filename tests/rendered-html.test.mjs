import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the AI research dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /AI 产业研究台/);
  assert.match(html, /当前选定池/);
  assert.match(html, /关键假设达成情况/);
  assert.match(html, /SERENITY RADAR/);
  assert.match(html, /估值纪律/);
  assert.match(html, /Baostock/);
  assert.match(html, /¥1,093\.98|¥1093\.98/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});
