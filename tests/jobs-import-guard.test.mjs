import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProviderJob,
  hashInitialJob,
  JobsImportGuardError,
  parseJobsImportCommand,
  planInitialJobs,
  validateInitialJobCatalog,
} from "../scripts/jobs-import-guard.mjs";
import {
  INITIAL_JOB_EMPLOYERS,
  INITIAL_JOBS,
  INITIAL_JOB_SOURCES,
} from "../src/server/jobs/initial-job-catalog.ts";

test("the initial catalog is valid, unique, and intentionally bounded", () => {
  const result = validateInitialJobCatalog(INITIAL_JOB_EMPLOYERS, INITIAL_JOB_SOURCES, INITIAL_JOBS);
  assert.equal(result.employers.length, 4);
  assert.equal(result.sources.length, 4);
  assert.equal(result.jobs.length, 11);
  assert.equal(new Set(result.jobs.map((job) => job.slug)).size, 11);
  assert.ok(result.jobs.every((job) => job.structuredDataEligible === false));
});

test("catalog validation rejects unsafe URLs, duplicates, and fabricated salary fragments", () => {
  const badEmployer = [{ ...INITIAL_JOB_EMPLOYERS[0], websiteUrl: "http://canonical.com" }];
  assert.throws(() => validateInitialJobCatalog(badEmployer, INITIAL_JOB_SOURCES.slice(0, 1), INITIAL_JOBS.slice(0, 1)), JobsImportGuardError);
  const duplicateJobs = [INITIAL_JOBS[0], INITIAL_JOBS[0]];
  assert.throws(() => validateInitialJobCatalog(INITIAL_JOB_EMPLOYERS, INITIAL_JOB_SOURCES, duplicateJobs), JobsImportGuardError);
  const partialSalary = [{ ...INITIAL_JOBS[0], salaryMin: 1 }];
  assert.throws(() => validateInitialJobCatalog(INITIAL_JOB_EMPLOYERS, INITIAL_JOB_SOURCES, partialSalary), JobsImportGuardError);
});

test("idempotent planning inserts only missing rows and rejects conflicts", () => {
  const first = INITIAL_JOBS[0];
  const emptyPlan = planInitialJobs([], [first]);
  assert.equal(emptyPlan.missing.length, 1);
  const existing = [{
    contentHash: hashInitialJob(first),
    externalId: first.externalId,
    slug: first.slug,
    sourceExternalId: first.sourceExternalId,
    sourceListingUrl: first.sourceListingUrl,
  }];
  const repeated = planInitialJobs(existing, [first]);
  assert.equal(repeated.missing.length, 0);
  assert.equal(repeated.retained.length, 1);
  assert.throws(() => planInitialJobs([{ ...existing[0], contentHash: "0".repeat(64) }], [first]), JobsImportGuardError);
});

test("provider verifiers match exact official identities", () => {
  const greenhouse = INITIAL_JOBS.find((job) => job.sourceExternalId === "canonical");
  const ashby = INITIAL_JOBS.find((job) => job.sourceExternalId === "Supabase");
  const lever = INITIAL_JOBS.find((job) => job.sourceExternalId === "veeva");
  assert.ok(greenhouse && ashby && lever);
  assert.doesNotThrow(() => assertProviderJob(greenhouse, INITIAL_JOB_SOURCES[0], {
    id: Number(greenhouse.externalId), title: greenhouse.title, absolute_url: greenhouse.sourceListingUrl,
    location: { name: greenhouse.providerMetadata.providerLocation },
  }));
  assert.doesNotThrow(() => assertProviderJob(ashby, INITIAL_JOB_SOURCES[2], {
    title: ashby.title, jobUrl: ashby.sourceListingUrl, applyUrl: ashby.applicationUrl, isListed: true,
    location: ashby.providerMetadata.providerLocation, publishedAt: ashby.publishedAt,
  }));
  assert.doesNotThrow(() => assertProviderJob(lever, INITIAL_JOB_SOURCES[3], {
    id: lever.externalId, text: lever.title.replace(" — ", " - "), hostedUrl: lever.sourceListingUrl,
    applyUrl: lever.applicationUrl, categories: { location: lever.providerMetadata.providerLocation },
    workplaceType: lever.providerMetadata.providerWorkplaceType,
  }));
  assert.throws(() => assertProviderJob(greenhouse, INITIAL_JOB_SOURCES[0], { id: "wrong" }), JobsImportGuardError);
});

test("jobs import commands require an explicit environment and mode", () => {
  assert.deepEqual(parseJobsImportCommand(["--development", "--preflight"]), { environment: "development", mode: "preflight" });
  assert.deepEqual(parseJobsImportCommand(["--production", "--execute"]), { environment: "production", mode: "execute" });
  assert.throws(() => parseJobsImportCommand(["--production"]), JobsImportGuardError);
});
