import "server-only";

import { randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import { getDatabaseUrl } from "../../db/environment.ts";
import * as schema from "../../db/schema.ts";
import { jobDiscoveryRuns, jobEmployers, jobs, jobSources } from "../../db/schema.ts";
import { validateCollectionDatabaseUrl, type CollectionDatabaseMode, type CollectionTrigger } from "../../ingestion/collection-store.ts";
import { VERIFIED_EMPLOYER_BOARDS } from "./employer-registry.ts";
import { isRelevantEngineeringJob, normalizeProviderJob, type NormalizedJob } from "./normalize-job.ts";
import type { DiscoveryResult, EmployerBoard } from "./types.ts";

export const JOB_DISCOVERY_LEASE_MS = 4 * 60 * 1_000;
const CONNECTION_TIMEOUT_MS = 15_000;

export type JobDiscoveryCounts = Readonly<{
  closed: number;
  discovered: number;
  inserted: number;
  pendingVerification: number;
  unchanged: number;
  updated: number;
  verified: number;
}>;

export type JobDiscoveryLease = Readonly<{ acquired: true; leaseToken: string; runId: string }>;
export type SkippedJobDiscoveryLease = Readonly<{ acquired: false; runId: string }>;

export type JobDiscoveryStore = Readonly<{
  acquire(trigger: CollectionTrigger, startedAt: Date): Promise<JobDiscoveryLease | SkippedJobDiscoveryLease>;
  close(): Promise<void>;
  fail(lease: JobDiscoveryLease, finishedAt: Date, failureCode: string): Promise<void>;
  persistAndFinish(lease: JobDiscoveryLease, result: DiscoveryResult, finishedAt: Date): Promise<JobDiscoveryCounts>;
}>;

export class JobDiscoveryLeaseLostError extends Error {
  constructor() { super("The job-discovery lease is no longer active."); this.name = "JobDiscoveryLeaseLostError"; }
}

type Database = NeonDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function assertLease(transaction: Transaction, lease: JobDiscoveryLease, now: Date) {
  const [active] = await transaction.select({ expires: jobDiscoveryRuns.leaseExpiresAt })
    .from(jobDiscoveryRuns)
    .where(and(eq(jobDiscoveryRuns.id, lease.runId), eq(jobDiscoveryRuns.leaseToken, lease.leaseToken), eq(jobDiscoveryRuns.status, "running")))
    .for("update");
  if (!active?.expires || active.expires <= now) throw new JobDiscoveryLeaseLostError();
}

function sameArray(left: readonly string[] | null, right: readonly string[] | null): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function hasMaterialChange(existing: typeof jobs.$inferSelect, candidate: NormalizedJob): boolean {
  return existing.title !== candidate.title || existing.category !== candidate.category ||
    existing.specialization !== candidate.specialization ||
    (candidate.employmentType !== null && existing.employmentType !== candidate.employmentType) ||
    (candidate.experienceLevel !== null && existing.experienceLevel !== candidate.experienceLevel) ||
    (candidate.workplaceArrangement !== null && existing.workplaceArrangement !== candidate.workplaceArrangement) ||
    (candidate.countryCode !== null && (existing.countryCode !== candidate.countryCode || existing.countryName !== candidate.countryName)) ||
    existing.locationText !== candidate.locationText ||
    (candidate.remoteCountries !== null && !sameArray(existing.remoteCountries, candidate.remoteCountries)) ||
    (candidate.remoteRestriction !== null && existing.remoteRestriction !== candidate.remoteRestriction) ||
    (candidate.providerUpdatedAt !== null && existing.providerUpdatedAt?.getTime() !== candidate.providerUpdatedAt.getTime()) ||
    (candidate.publishedAt !== null && existing.publishedAt?.getTime() !== candidate.publishedAt.getTime()) ||
    existing.contentHash !== candidate.contentHash;
}

export function decideMissingJobLifecycle(
  current: Readonly<{ applicationDeadline: Date | null; missingObservationCount: number; missingSince: Date | null }>,
  now: Date,
) {
  const missingObservationCount = current.missingObservationCount + 1;
  const deadlineExpired = current.applicationDeadline !== null && current.applicationDeadline <= now;
  const closed = deadlineExpired || missingObservationCount >= 2;
  return Object.freeze({
    closedAt: closed ? now : null,
    closureReason: closed ? (deadlineExpired ? "application_deadline" as const : "repeated_absence" as const) : null,
    missingObservationCount,
    missingSince: current.missingSince ?? now,
    status: closed ? (deadlineExpired ? "expired" as const : "closed" as const) : "unverified" as const,
  });
}

async function registerBoards(transaction: Transaction, now: Date) {
  await transaction.insert(jobEmployers).values(VERIFIED_EMPLOYER_BOARDS.map((board) => ({
      name: board.employerName, slug: board.employerSlug, verificationUrl: board.careersUrl,
      verifiedAt: now, websiteUrl: board.websiteUrl, updatedAt: now,
    }))).onConflictDoNothing();
  const employerRows = await transaction.select().from(jobEmployers)
    .where(inArray(jobEmployers.slug, VERIFIED_EMPLOYER_BOARDS.map((board) => board.employerSlug)));
  if (employerRows.length !== VERIFIED_EMPLOYER_BOARDS.length) throw new Error("The verified employer registry did not resolve completely.");
  for (const board of VERIFIED_EMPLOYER_BOARDS) {
    const employer = employerRows.find((row) => row.slug === board.employerSlug);
    if (!employer || employer.name !== board.employerName || employer.websiteUrl !== board.websiteUrl) throw new Error("A verified employer conflicts with the registry.");
  }
  await transaction.update(jobEmployers).set({ verifiedAt: now, updatedAt: now })
    .where(inArray(jobEmployers.id, employerRows.map((row) => row.id)));
  await transaction.insert(jobSources).values(VERIFIED_EMPLOYER_BOARDS.map((board) => {
    const employer = employerRows.find((row) => row.slug === board.employerSlug);
    if (!employer) throw new Error("A source employer is missing.");
    return {
      canonicalUrl: board.canonicalUrl, employerId: employer.id, externalSourceId: board.externalSourceId,
      isActive: true, lastVerifiedAt: now, provider: board.provider, verificationUrl: board.careersUrl, updatedAt: now,
    };
  })).onConflictDoNothing();
  const sourceRows = await transaction.select().from(jobSources)
    .where(inArray(jobSources.externalSourceId, VERIFIED_EMPLOYER_BOARDS.map((board) => board.externalSourceId)));
  if (sourceRows.length !== VERIFIED_EMPLOYER_BOARDS.length) throw new Error("The verified recruiting-source registry did not resolve completely.");
  for (const board of VERIFIED_EMPLOYER_BOARDS) {
    const employer = employerRows.find((row) => row.slug === board.employerSlug);
    const source = sourceRows.find((row) => row.provider === board.provider && row.externalSourceId === board.externalSourceId);
    if (!employer || !source || source.employerId !== employer.id || source.canonicalUrl !== board.canonicalUrl) throw new Error("A recruiting source conflicts with the registry.");
  }
  return sourceRows;
}

async function synchronizeSuccessfulBoard(
  transaction: Transaction,
  board: EmployerBoard,
  source: typeof jobSources.$inferSelect,
  providerJobs: DiscoveryResult["successes"][number]["jobs"],
  now: Date,
): Promise<JobDiscoveryCounts> {
  const providerIds = new Set(providerJobs.map((job) => job.externalId));
  const candidates = providerJobs.filter(isRelevantEngineeringJob).map((job) => normalizeProviderJob(board, job));
  if (new Set(candidates.map((job) => job.externalId)).size !== candidates.length) throw new Error("A provider returned duplicate vacancy identities.");
  const existing = await transaction.select().from(jobs).where(eq(jobs.sourceId, source.id));
  const existingById = new Map(existing.map((job) => [job.externalId, job]));
  const newRows: (typeof jobs.$inferInsert)[] = [];
  const changedRows: Record<string, unknown>[] = [];
  let inserted = 0; let updated = 0; let unchanged = 0; let verified = 0; let closed = 0; let pendingVerification = 0;

  for (const candidate of candidates) {
    const current = existingById.get(candidate.externalId);
    if (!current) {
      newRows.push({
        applicationUrl: candidate.applicationUrl, category: candidate.category, certifications: [], collectedAt: now,
        contentHash: candidate.contentHash, countryCode: candidate.countryCode, countryName: candidate.countryName,
        employmentType: candidate.employmentType, experienceLevel: candidate.experienceLevel, externalId: candidate.externalId,
        lastCheckedAt: now, lastSeenAt: now, lastVerifiedAt: now, locationText: candidate.locationText,
        overview: candidate.overview, providerMetadata: candidate.providerMetadata, providerUpdatedAt: candidate.providerUpdatedAt,
        publishedAt: candidate.publishedAt, remoteCountries: candidate.remoteCountries ? [...candidate.remoteCountries] : null,
        remoteRestriction: candidate.remoteRestriction, requirements: [], responsibilities: [], skills: [...candidate.skills],
        slug: candidate.slug, sourceId: source.id, sourceListingUrl: candidate.sourceListingUrl,
        specialization: candidate.specialization, status: "open", structuredDataEligible: false, title: candidate.title,
        updatedAt: now, verificationEvidence: candidate.verificationEvidence, workplaceArrangement: candidate.workplaceArrangement,
      });
      inserted += 1; verified += 1;
      continue;
    }
    const changed = hasMaterialChange(current, candidate);
    if (changed) changedRows.push({
      category: candidate.category, content_hash: candidate.contentHash,
      country_code: candidate.countryCode ?? current.countryCode, country_name: candidate.countryName ?? current.countryName,
      employment_type: candidate.employmentType ?? current.employmentType,
      experience_level: candidate.experienceLevel ?? current.experienceLevel, id: current.id,
      location_text: candidate.locationText, provider_metadata: candidate.providerMetadata,
      provider_updated_at: (candidate.providerUpdatedAt ?? current.providerUpdatedAt)?.toISOString() ?? null,
      published_at: (candidate.publishedAt ?? current.publishedAt)?.toISOString() ?? null,
      remote_countries: candidate.remoteCountries ? [...candidate.remoteCountries] : current.remoteCountries,
      remote_restriction: candidate.remoteRestriction ?? current.remoteRestriction,
      specialization: candidate.specialization, title: candidate.title,
      verification_evidence: candidate.verificationEvidence,
      workplace_arrangement: candidate.workplaceArrangement ?? current.workplaceArrangement,
    });
    verified += 1;
    if (changed) updated += 1; else unchanged += 1;
  }

  if (newRows.length > 0) await transaction.insert(jobs).values(newRows);
  if (changedRows.length > 0) await transaction.execute(sql`
    UPDATE jobs AS job SET
      category = value.category::job_category,
      content_hash = value.content_hash,
      country_code = value.country_code,
      country_name = value.country_name,
      employment_type = value.employment_type::employment_type,
      experience_level = value.experience_level::experience_level,
      location_text = value.location_text,
      provider_metadata = value.provider_metadata,
      provider_updated_at = value.provider_updated_at,
      published_at = value.published_at,
      remote_countries = CASE WHEN value.remote_countries IS NULL THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(value.remote_countries)) END,
      remote_restriction = value.remote_restriction,
      specialization = value.specialization,
      title = value.title,
      verification_evidence = value.verification_evidence,
      workplace_arrangement = value.workplace_arrangement::workplace_arrangement
    FROM jsonb_to_recordset(${JSON.stringify(changedRows)}::jsonb) AS value(
      id uuid, category text, content_hash text, country_code text, country_name text,
      employment_type text, experience_level text, location_text text, provider_metadata jsonb,
      provider_updated_at timestamptz, published_at timestamptz, remote_countries jsonb,
      remote_restriction text, specialization text, title text, verification_evidence text,
      workplace_arrangement text
    )
    WHERE job.id = value.id
  `);
  if (providerIds.size > 0) {
    await transaction.update(jobs).set({
      closedAt: null, closureReason: null, lastCheckedAt: now, lastSeenAt: now, lastVerifiedAt: now,
      missingObservationCount: 0, missingSince: null, status: "open", updatedAt: now,
    }).where(and(eq(jobs.sourceId, source.id), inArray(jobs.externalId, [...providerIds])));
  }

  for (const current of existing) {
    if (providerIds.has(current.externalId)) continue;
    const lifecycle = decideMissingJobLifecycle(current, now);
    await transaction.update(jobs).set({
      ...lifecycle, lastCheckedAt: now, updatedAt: now,
    }).where(eq(jobs.id, current.id));
    if ((lifecycle.status === "closed" || lifecycle.status === "expired") && current.status !== lifecycle.status) closed += 1;
    else if (lifecycle.status === "unverified") pendingVerification += 1;
  }

  await transaction.update(jobSources).set({
    consecutiveFailures: 0, lastAttemptedSyncAt: now, lastSuccessfulSyncAt: now, lastVerifiedAt: now, updatedAt: now,
  }).where(eq(jobSources.id, source.id));
  return { closed, discovered: candidates.length, inserted, pendingVerification, unchanged, updated, verified };
}

function addCounts(left: JobDiscoveryCounts, right: JobDiscoveryCounts): JobDiscoveryCounts {
  return {
    closed: left.closed + right.closed, discovered: left.discovered + right.discovered,
    inserted: left.inserted + right.inserted, pendingVerification: left.pendingVerification + right.pendingVerification,
    unchanged: left.unchanged + right.unchanged, updated: left.updated + right.updated, verified: left.verified + right.verified,
  };
}

const zeroCounts: JobDiscoveryCounts = Object.freeze({ closed: 0, discovered: 0, inserted: 0, pendingVerification: 0, unchanged: 0, updated: 0, verified: 0 });

class PostgresJobDiscoveryStore implements JobDiscoveryStore {
  private readonly database: Database;
  private readonly pool: Pool;

  constructor(database: Database, pool: Pool) {
    this.database = database;
    this.pool = pool;
  }

  async acquire(trigger: CollectionTrigger, startedAt: Date) {
    return this.database.transaction(async (transaction) => {
      await transaction.update(jobDiscoveryRuns).set({
        failureCode: "lease_expired", finishedAt: startedAt, leaseExpiresAt: null, leaseToken: null, status: "failed", updatedAt: startedAt,
      }).where(and(eq(jobDiscoveryRuns.status, "running"), lte(jobDiscoveryRuns.leaseExpiresAt, startedAt)));
      const leaseToken = randomUUID();
      const [acquired] = await transaction.insert(jobDiscoveryRuns).values({
        leaseExpiresAt: new Date(startedAt.getTime() + JOB_DISCOVERY_LEASE_MS), leaseToken, startedAt, trigger,
      }).onConflictDoNothing().returning({ id: jobDiscoveryRuns.id });
      if (acquired) return Object.freeze({ acquired: true as const, leaseToken, runId: acquired.id });
      const [skipped] = await transaction.insert(jobDiscoveryRuns).values({
        failureCode: "active_lease", finishedAt: startedAt, startedAt, status: "skipped", trigger,
      }).returning({ id: jobDiscoveryRuns.id });
      if (!skipped) throw new Error("The skipped job-discovery run was not recorded.");
      return Object.freeze({ acquired: false as const, runId: skipped.id });
    });
  }

  async persistAndFinish(lease: JobDiscoveryLease, result: DiscoveryResult, finishedAt: Date) {
    return this.database.transaction(async (transaction) => {
      await assertLease(transaction, lease, finishedAt);
      const sourceRows = await registerBoards(transaction, finishedAt);
      let counts = zeroCounts;
      for (const success of result.successes) {
        const source = sourceRows.find((row) => row.provider === success.board.provider && row.externalSourceId === success.board.externalSourceId);
        if (!source) throw new Error("A successful source was not registered.");
        counts = addCounts(counts, await synchronizeSuccessfulBoard(transaction, success.board, source, success.jobs, finishedAt));
      }
      for (const failure of result.failures) {
        const source = sourceRows.find((row) => row.provider === failure.board.provider && row.externalSourceId === failure.board.externalSourceId);
        if (source) await transaction.update(jobSources).set({
          consecutiveFailures: source.consecutiveFailures + 1, lastAttemptedSyncAt: finishedAt, updatedAt: finishedAt,
        }).where(eq(jobSources.id, source.id));
      }
      const processed = VERIFIED_EMPLOYER_BOARDS.map((board) => `${board.provider}:${board.externalSourceId}`);
      const failed = result.failures.map((failure) => `${failure.board.provider}:${failure.board.externalSourceId}`);
      const status = result.successes.length === 0 ? "failed" : failed.length ? "partially_succeeded" : "succeeded";
      const [completed] = await transaction.update(jobDiscoveryRuns).set({
        failedSourceKeys: failed, failureCode: status === "failed" ? "all_sources_failed" : status === "partially_succeeded" ? "provider_failures" : null,
        finishedAt, jobsDiscovered: counts.discovered, jobsInserted: counts.inserted, jobsMarkedClosed: counts.closed,
        jobsPendingVerification: counts.pendingVerification, jobsUnchanged: counts.unchanged, jobsUpdated: counts.updated,
        jobsVerified: counts.verified, leaseExpiresAt: null, leaseToken: null, processedSourceKeys: processed,
        sourcesAttempted: processed.length, sourcesFailed: failed.length, sourcesSucceeded: processed.length - failed.length,
        status, updatedAt: finishedAt,
      }).where(and(eq(jobDiscoveryRuns.id, lease.runId), eq(jobDiscoveryRuns.leaseToken, lease.leaseToken), eq(jobDiscoveryRuns.status, "running")))
        .returning({ id: jobDiscoveryRuns.id });
      if (!completed) throw new JobDiscoveryLeaseLostError();
      return Object.freeze(counts);
    });
  }

  async fail(lease: JobDiscoveryLease, finishedAt: Date, failureCode: string) {
    await this.database.update(jobDiscoveryRuns).set({
      failureCode, finishedAt, leaseExpiresAt: null, leaseToken: null, status: "failed", updatedAt: finishedAt,
    }).where(and(eq(jobDiscoveryRuns.id, lease.runId), eq(jobDiscoveryRuns.leaseToken, lease.leaseToken), eq(jobDiscoveryRuns.status, "running")));
  }

  async close() { await this.pool.end(); }
}

export async function createJobDiscoveryStore(options: Readonly<{
  connectionString?: string;
  expectedEndpoint?: string;
  mode?: CollectionDatabaseMode;
}> = {}): Promise<JobDiscoveryStore> {
  const connectionString = validateCollectionDatabaseUrl(options.connectionString ?? getDatabaseUrl(), {
    expectedEndpoint: options.expectedEndpoint, mode: options.mode ?? "pooled",
  });
  const pool = new Pool({ connectionString, connectionTimeoutMillis: CONNECTION_TIMEOUT_MS, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("SET statement_timeout = '30s'");
    await client.query("SET lock_timeout = '5s'");
  } finally { client.release(); }
  return new PostgresJobDiscoveryStore(drizzle(pool, { schema }), pool);
}
