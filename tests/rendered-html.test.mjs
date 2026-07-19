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
  assert.match(html, /AI 推理产业链/);
  assert.match(html, /证据如何变成盈利/);
  assert.match(html, /5 个验证维度/);
  assert.match(html, /2030E 市场中值/);
  assert.match(html, /证据加权中值/);
  assert.match(html, /主线成立，不等于所有公司都值得买/);
  assert.match(html, /Baostock/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});
