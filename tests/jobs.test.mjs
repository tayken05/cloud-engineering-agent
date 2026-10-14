import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJobQuery,
  MAX_JOB_PAGE,
  parseJobFilters,
} from "../src/features/jobs/job-filters.ts";
import {
  buildJobPostingStructuredData,
  serializeStructuredData,
} from "../src/features/jobs/job-structured-data.ts";
import { INITIAL_JOBS } from "../src/server/jobs/initial-job-catalog.ts";

test("job filters accept supported values and reject malformed inputs", () => {
  const filters = parseJobFilters({
    category: "linux", country: "ng", employer: "canonical", employment: "full_time",
    experience: "junior", page: "999", q: "  kernel  ", salary: "disclosed",
    specialization: "Linux kernel engineering", status: "all", workplace: "remote",
  });
  assert.deepEqual(filters, {
    category: "linux", country: "NG", employer: "canonical", employment: "full_time",
    experience: "junior", page: MAX_JOB_PAGE, query: "kernel", salaryDisclosed: true,
    specialization: "Linux kernel engineering", status: "all", workplace: "remote",
  });
  assert.deepEqual(parseJobFilters({ category: "other", country: "NGA", employer: "../bad", page: "-2", status: "private" }), {
    page: 1, salaryDisclosed: false, status: "open",
  });
});

test("shareable job URLs preserve active filters", () => {
  const query = buildJobQuery({
    category: "linux", country: "NG", employer: "canonical", employment: "full_time",
    experience: "junior", page: 1, query: "kernel", salaryDisclosed: true,
    specialization: "Linux kernel engineering", status: "all", workplace: "remote",
  }, 2);
  const url = new URL(query, "https://example.test");
  assert.equal(url.pathname, "/jobs");
  assert.equal(url.searchParams.get("employer"), "canonical");
  assert.equal(url.searchParams.get("specialization"), "Linux kernel engineering");
  assert.equal(url.searchParams.get("page"), "2");
});

test("catalog entries preserve stated geography, dates, and salary absence", () => {
  const nigeria = INITIAL_JOBS.filter((job) => job.countryCode === "NG");
  assert.equal(nigeria.length, 3);
  assert.ok(nigeria.every((job) => !job.remoteCountries || job.remoteCountries.includes("NG")));
  const worldwide = INITIAL_JOBS.filter((job) => job.remoteRestriction === "Worldwide");
  assert.ok(worldwide.length >= 7);
  const paid = INITIAL_JOBS.filter((job) => job.salaryCurrency);
  assert.equal(paid.length, 1);
  assert.equal(paid[0].salaryCurrency, "USD");
  assert.ok(INITIAL_JOBS.every((job) => job.applicationDeadline === null));
});

test("JobPosting markup fails closed and escapes script-breaking text", () => {
  const base = {
    ...INITIAL_JOBS.find((job) => job.sourceExternalId === "veeva"),
    id: "00000000-0000-0000-0000-000000000001",
    employerName: "Veeva Systems",
    employerWebsiteUrl: "https://www.veeva.com",
    employerVerificationUrl: "https://careers.veeva.com",
    provider: "lever",
    sourceUrl: "https://jobs.lever.co/veeva",
    publishedAt: new Date("2026-10-01T00:00:00Z"),
    providerUpdatedAt: null,
    lastVerifiedAt: new Date("2026-10-14T00:00:00Z"),
    applicationDeadline: null,
  };
  assert.equal(buildJobPostingStructuredData(base), null);
  const eligible = buildJobPostingStructuredData({ ...base, structuredDataEligible: true });
  assert.ok(eligible);
  assert.equal(eligible["@type"], "JobPosting");
  assert.equal(eligible.jobLocationType, "TELECOMMUTE");
  assert.doesNotMatch(serializeStructuredData({ value: "</script>" }), /</);
});
