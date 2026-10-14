import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.SHELL_TEST_URL ?? "http://127.0.0.1:3100";

async function getNews(search = "") {
  const response = await fetch(new URL(`/stories${search}`, baseUrl), {
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200);
  return response.text();
}

function resultList(html) {
  const match = html.match(/<ol class="news-list">([\s\S]*?)<\/ol>/);
  assert.ok(match, "Expected a rendered news result list");
  return match[1];
}

test("Stories & News renders collected publisher records without secrets", async () => {
  const html = await getNews();
  assert.match(html, /Collected publisher updates/);
  assert.match(html, /Not independently verified/);
  assert.match(html, /Last successful collection:/);
  assert.match(html, /AWS Architecture Blog|Google Cloud Blog|Cloudflare Blog/);
  assert.match(html, /target="_blank"/);
  assert.doesNotMatch(html, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(html, /DATABASE_URL/);
  assert.doesNotMatch(html, /ep-sweet-bread|ep-spring-grass/i);
});

test("category and publisher filters constrain collected records", async () => {
  const networking = await getNews("?topic=networking");
  assert.match(resultList(networking), /Cloudflare Blog/);
  assert.doesNotMatch(resultList(networking), /AWS Architecture Blog/);

  const kubernetes = await getNews("?source=kubernetes-blog");
  assert.match(resultList(kubernetes), /Kubernetes Blog/);
  assert.doesNotMatch(resultList(kubernetes), /Cloudflare Blog/);
});

test("a valid category without records renders the honest empty state", async () => {
  const html = await getNews("?topic=cybersecurity");
  assert.match(html, /No publisher updates match these filters/);
  assert.match(html, /0 collected items/);
});
