import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.SHELL_TEST_URL ?? "http://127.0.0.1:3100";

async function getSources(search = "") {
  const response = await fetch(new URL(`/sources${search}`, baseUrl), {
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200);
  return response.text();
}

test("the Sources page renders the database-backed approved catalog", async () => {
  const html = await getSources();
  assert.match(html, /11<!-- --> <!-- -->sources/);
  for (const name of [
    "AWS Architecture Blog",
    "Microsoft Azure Blog",
    "Google Cloud Blog",
    "Linux Kernel Archives",
    "NVIDIA Technical Blog",
  ]) {
    assert.match(html, new RegExp(name));
  }
  assert.doesNotMatch(html, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(html, /DATABASE_URL/);
  assert.doesNotMatch(html, /ep-sweet-bread|ep-spring-grass/i);
});

test("topic and text filters limit database results", async () => {
  const cloud = await getSources("?topic=cloud_engineering");
  assert.match(cloud, /3<!-- --> <!-- -->sources/);
  assert.match(cloud, /AWS Architecture Blog/);
  assert.match(cloud, /Microsoft Azure Blog/);
  assert.match(cloud, /Google Cloud Blog/);
  assert.doesNotMatch(cloud, /Linux Kernel Archives/);

  const cloudflare = await getSources("?q=Cloudflare");
  assert.match(cloudflare, /1<!-- --> <!-- -->source/);
  assert.match(cloudflare, /Cloudflare Blog/);
  assert.doesNotMatch(cloudflare, /AWS Architecture Blog/);
});

test("a valid filter with no records renders the honest empty state", async () => {
  const html = await getSources("?status=inactive");
  assert.match(html, /No sources match these filters/);
  assert.match(html, /0 sources/);
  assert.doesNotMatch(html, /AWS Architecture Blog/);
});
