import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.JOBS_TEST_URL ?? "http://127.0.0.1:3100";

test("the Jobs Explorer serves genuine records and shareable filters", async () => {
  const response = await fetch(new URL("/jobs?employer=canonical&category=linux", baseUrl), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Jobs &amp; Opportunities/);
  assert.match(html, /Junior Linux Kernel Engineer/);
  assert.doesNotMatch(html, /Application Security Engineer/);
});

test("a stable job detail page links to the official application destination", async () => {
  const path = "/jobs/canonical-junior-linux-kernel-engineer";
  const response = await fetch(new URL(path, baseUrl), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Apply on Employer Website/);
  assert.match(html, /https:\/\/job-boards\.greenhouse\.io\/canonical\/jobs\/5370815/);
  assert.match(html, /rel="noreferrer"/);
});

test("unknown job slugs return 404 and no public import endpoint exists", async () => {
  const [missing, admin] = await Promise.all([
    fetch(new URL("/jobs/not-a-real-vacancy", baseUrl), { signal: AbortSignal.timeout(30_000) }),
    fetch(new URL("/api/jobs/import", baseUrl), { method: "POST", signal: AbortSignal.timeout(30_000) }),
  ]);
  assert.equal(missing.status, 404);
  assert.equal(admin.status, 404);
});

test("the sitemap contains the public jobs index and open job detail URLs", async () => {
  const response = await fetch(new URL("/sitemap.xml", baseUrl), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.match(xml, /https:\/\/cloud-engineering-agent\.vercel\.app\/jobs<\/loc>/);
  assert.match(xml, /canonical-junior-linux-kernel-engineer/);
});
