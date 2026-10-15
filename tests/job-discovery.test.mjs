import assert from "node:assert/strict";
import test from "node:test";

import { collectEmployerBoards } from "../src/server/jobs/discovery/collect-boards.ts";
import { decideMissingJobLifecycle } from "../src/server/jobs/discovery/job-discovery-store.ts";
import { VERIFIED_EMPLOYER_BOARDS } from "../src/server/jobs/discovery/employer-registry.ts";
import { isRelevantEngineeringJob, normalizeProviderJob } from "../src/server/jobs/discovery/normalize-job.ts";
import { fetchEmployerBoard, ProviderAdapterError } from "../src/server/jobs/discovery/provider-adapters.ts";
import { runJobDiscovery } from "../src/server/jobs/discovery/run-job-discovery.ts";

const board = VERIFIED_EMPLOYER_BOARDS.find((item) => item.employerSlug === "canonical");
if (!board) throw new Error("Missing fixture board.");

function providerJob(overrides = {}) {
  return {
    applicationUrl: "https://job-boards.greenhouse.io/canonical/jobs/123",
    description: "Build Kubernetes cloud infrastructure with Linux and Terraform.",
    employmentType: "Full time",
    externalId: "123",
    location: "Remote, Nigeria",
    providerUpdatedAt: new Date("2026-10-14T00:00:00Z"),
    publishedAt: null,
    sourceListingUrl: "https://job-boards.greenhouse.io/canonical/jobs/123",
    title: "Junior Platform Engineer",
    workplaceType: "Remote",
    ...overrides,
  };
}

test("Greenhouse responses require complete official identities and sanitize descriptions", async () => {
  const result = await fetchEmployerBoard(board, {
    fetcher: async (_url, init) => {
      assert.equal(init.redirect, "error");
      return new Response(JSON.stringify({ jobs: [{
        absolute_url: "https://job-boards.greenhouse.io/canonical/jobs/123",
        content: "<p>Linux &amp; cloud</p><script>unsafe()</script>", id: 123,
        location: { name: "Remote, Nigeria" }, title: "Cloud Engineer", updated_at: "2026-10-14T00:00:00Z",
      }] }), { headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].description, "Linux & cloud");
  assert.equal(result[0].externalId, "123");

  await assert.rejects(() => fetchEmployerBoard(board, {
    fetcher: async () => new Response(JSON.stringify({ jobs: [{ id: 1, title: "Cloud Engineer", absolute_url: "https://evil.example/job" }] }), {
      headers: { "content-type": "application/json" },
    }),
  }), ProviderAdapterError);
});

test("deterministic matching excludes nontechnical roles and preserves stated geography", () => {
  const job = providerJob();
  assert.equal(isRelevantEngineeringJob(job), true);
  assert.equal(isRelevantEngineeringJob(providerJob({ title: "Cloud Account Executive" })), false);
  const normalized = normalizeProviderJob(board, job);
  assert.equal(normalized.category, "platform_engineering");
  assert.equal(normalized.countryCode, "NG");
  assert.deepEqual(normalized.remoteCountries, ["NG"]);
  assert.match(normalized.remoteRestriction, /Employer listing location/);
  assert.match(normalized.slug, /^canonical-junior-platform-engineer-[0-9a-f]{10}$/);
  assert.equal(normalized.experienceLevel, "junior");
});

test("provider failures retry once and remain isolated from successful boards", async () => {
  const boards = VERIFIED_EMPLOYER_BOARDS.slice(0, 2);
  const calls = new Map();
  const result = await collectEmployerBoards(boards, {
    fetchBoard: async (item) => {
      calls.set(item.employerSlug, (calls.get(item.employerSlug) ?? 0) + 1);
      if (item === boards[1]) throw new ProviderAdapterError("http");
      return [providerJob()];
    },
  });
  assert.equal(result.successes.length, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(calls.get(boards[0].employerSlug), 1);
  assert.equal(calls.get(boards[1].employerSlug), 2);
});

test("closure needs two complete-board absences while an actual deadline expires immediately", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const first = decideMissingJobLifecycle({ applicationDeadline: null, missingObservationCount: 0, missingSince: null }, now);
  assert.equal(first.status, "unverified");
  assert.equal(first.missingObservationCount, 1);
  const second = decideMissingJobLifecycle({ applicationDeadline: null, missingObservationCount: 1, missingSince: now }, now);
  assert.equal(second.status, "closed");
  assert.equal(second.closureReason, "repeated_absence");
  const expired = decideMissingJobLifecycle({ applicationDeadline: new Date("2026-10-13T00:00:00Z"), missingObservationCount: 0, missingSince: null }, now);
  assert.equal(expired.status, "expired");
  assert.equal(expired.closureReason, "application_deadline");
});

function fakeStore(acquired = true) {
  const calls = { close: 0, fail: 0, persist: 0 };
  return {
    calls,
    store: {
      acquire: async () => acquired
        ? { acquired: true, leaseToken: "00000000-0000-4000-8000-000000000001", runId: "run-1" }
        : { acquired: false, runId: "run-skipped" },
      close: async () => { calls.close += 1; },
      fail: async () => { calls.fail += 1; },
      persistAndFinish: async () => {
        calls.persist += 1;
        return { closed: 1, discovered: 4, inserted: 2, pendingVerification: 1, unchanged: 3, updated: 1, verified: 6 };
      },
    },
  };
}

test("discovery runs report durable results, skips, and unexpected failure", async () => {
  const tracked = fakeStore();
  const result = await runJobDiscovery({
    collect: async () => ({ failures: [], successes: [{ board, jobs: [providerJob()] }] }),
    store: tracked.store, trigger: "scheduled",
  });
  assert.deepEqual({ closed: result.closedJobs, inserted: result.insertedJobs, pending: result.pendingVerificationJobs }, { closed: 1, inserted: 2, pending: 1 });
  assert.equal(tracked.calls.persist, 1);
  assert.equal(tracked.calls.close, 1);

  const skipped = fakeStore(false);
  assert.equal((await runJobDiscovery({ collect: async () => { throw new Error("must not run"); }, store: skipped.store, trigger: "scheduled" })).status, "skipped");

  const failed = fakeStore();
  await assert.rejects(() => runJobDiscovery({ collect: async () => { throw new Error("provider"); }, store: failed.store, trigger: "manual" }), /provider/);
  assert.equal(failed.calls.fail, 1);
});
