import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { Pool } from "@neondatabase/serverless";
import { and, eq, inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import { jobEmployers, jobs, jobSources } from "../src/server/db/schema.ts";
import { INITIAL_JOB_EMPLOYERS, INITIAL_JOBS, INITIAL_JOB_SOURCES } from "../src/server/jobs/initial-job-catalog.ts";
import { jobsMigrationConfig } from "./jobs-migration.config.mjs";
import {
  assertProviderJob,
  hashInitialJob,
  JobsImportGuardError,
  jobsImportConfig,
  parseJobsImportCommand,
  planInitialJobs,
  validateInitialJobCatalog,
} from "./jobs-import-guard.mjs";
import { loadProductionCredential } from "./production-migration-guard.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";
import { migrationHistoryMatches } from "./migration-history-guard.mjs";
import { loadDevelopmentCredential, sourceCatalogConfig } from "./source-catalog-guard.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = validateInitialJobCatalog(INITIAL_JOB_EMPLOYERS, INITIAL_JOB_SOURCES, INITIAL_JOBS);
const MAX_PROVIDER_BYTES = 8 * 1024 * 1024;

function stop(message) { throw new JobsImportGuardError(message); }

function assertIgnored(file) {
  const result = spawnSync("git", ["check-ignore", "--quiet", "--", file], { cwd: projectRoot, stdio: "ignore" });
  if (result.status !== 0) stop(`${file} must be ignored by Git.`);
}

async function safeJson(url) {
  const parsed = new URL(url);
  if (!new Set(["boards-api.greenhouse.io", "api.ashbyhq.com", "api.lever.co", "api.eu.lever.co"]).has(parsed.hostname)) stop("Provider request host is not allowlisted.");
  const response = await fetch(parsed, {
    headers: { Accept: "application/json", "User-Agent": "CloudEngineeringAgent/1.0 jobs-verification" },
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok || response.status >= 300 && response.status < 400) stop("An official provider endpoint did not return a successful direct response.");
  if (!response.headers.get("content-type")?.toLowerCase().includes("json")) stop("An official provider endpoint did not return JSON.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PROVIDER_BYTES) stop("An official provider response exceeds the safe size limit.");
  const reader = response.body?.getReader();
  if (!reader) stop("An official provider response had no body.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PROVIDER_BYTES) { await reader.cancel(); stop("An official provider response exceeds the safe size limit."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { stop("An official provider response was malformed JSON."); }
}

async function verifyLiveListings() {
  const records = new Map();
  for (const source of catalog.sources) {
    const sourceJobs = catalog.jobs.filter((job) => job.sourceExternalId === source.externalSourceId);
    if (source.provider === "greenhouse") {
      const payload = await safeJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.externalSourceId)}/jobs`);
      if (!Array.isArray(payload?.jobs)) stop("A Greenhouse board response is invalid.");
      for (const job of sourceJobs) records.set(job.slug, payload.jobs.find((record) => String(record.id) === job.externalId));
    } else if (source.provider === "ashby") {
      const payload = await safeJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.externalSourceId)}`);
      if (!Array.isArray(payload?.jobs)) stop("An Ashby board response is invalid.");
      for (const job of sourceJobs) records.set(job.slug, payload.jobs.find((record) => record.jobUrl === job.sourceListingUrl));
    } else if (source.provider === "lever") {
      for (const job of sourceJobs) {
        records.set(job.slug, await safeJson(`https://api.lever.co/v0/postings/${encodeURIComponent(source.externalSourceId)}/${encodeURIComponent(job.externalId)}`));
      }
    } else stop("The initial importer cannot verify an employer-hosted feed.");
    for (const job of sourceJobs) assertProviderJob(job, source, records.get(job.slug));
  }
  return records.size;
}

async function authFingerprint(client) {
  const tables = await client.query("SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') ORDER BY c.relname");
  const columns = await client.query("SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum");
  const constraints = await client.query("SELECT c.relname,con.conname,con.contype,pg_get_constraintdef(con.oid,true) FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='neon_auth' ORDER BY c.relname,con.conname");
  const indexes = await client.query("SELECT tablename,indexname,indexdef FROM pg_catalog.pg_indexes WHERE schemaname='neon_auth' ORDER BY tablename,indexname");
  return { fingerprint: createHash("sha256").update(JSON.stringify({ columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows, tables: tables.rows })).digest("hex"), tableCount: tables.rowCount };
}

async function existingRows(db) {
  return db.select({
    contentHash: jobs.contentHash,
    externalId: jobs.externalId,
    slug: jobs.slug,
    sourceExternalId: jobSources.externalSourceId,
    sourceListingUrl: jobs.sourceListingUrl,
  }).from(jobs).innerJoin(jobSources, eq(jobs.sourceId, jobSources.id)).where(or(
    inArray(jobs.slug, catalog.jobs.map((job) => job.slug)),
    inArray(jobs.sourceListingUrl, catalog.jobs.map((job) => job.sourceListingUrl)),
  ));
}

async function inspect(client, production) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    const identity = await client.query("SELECT current_database() AS database_name,current_schema() AS current_schema,current_schemas(false) AS schemas");
    const current = identity.rows[0];
    if (current?.database_name !== jobsImportConfig.database || current.current_schema !== "public" || current.schemas?.includes("neon_auth")) stop("The database identity or search path is unsafe.");
    const history = await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id");
    if (!migrationHistoryMatches(history.rows)) stop("Migration history does not include the exact reviewed jobs migration.");
    const tables = await client.query("SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname=ANY($1::text[]) ORDER BY c.relname", [jobsMigrationConfig.tables]);
    if (tables.rowCount !== jobsMigrationConfig.tables.length) stop("Required jobs tables are missing.");
    const auth = await authFingerprint(client);
    if (production && auth.tableCount !== productionMigrationConfig.expectedAuthTableCount) stop("The managed authentication catalog differs from the baseline.");
    const counts = (await client.query(`SELECT
      (SELECT count(*)::integer FROM public.sources) AS sources,
      (SELECT count(*)::integer FROM public.source_items) AS source_items,
      (SELECT count(*)::integer FROM public.stories) AS stories,
      (SELECT count(*)::integer FROM public.story_source_items) AS story_source_items,
      (SELECT count(*)::integer FROM public.collection_runs) AS collection_runs,
      (SELECT count(*)::integer FROM public.job_employers) AS job_employers,
      (SELECT count(*)::integer FROM public.job_sources) AS job_sources,
      (SELECT count(*)::integer FROM public.jobs) AS jobs`)).rows[0];
    const plan = planInitialJobs(await existingRows(drizzle(client)), catalog.jobs);
    await client.query("COMMIT");
    return { auth, counts, plan };
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
}

async function writeCatalog(client) {
  const db = drizzle(client);
  const verifiedAt = new Date();
  return db.transaction(async (tx) => {
    for (const employer of catalog.employers) {
      await tx.insert(jobEmployers).values({ ...employer, verifiedAt, updatedAt: verifiedAt }).onConflictDoNothing();
    }
    const employerRows = await tx.select().from(jobEmployers).where(inArray(jobEmployers.slug, catalog.employers.map((item) => item.slug)));
    if (employerRows.length !== catalog.employers.length) stop("Employer registration did not reach the approved state.");
    for (const employer of catalog.employers) {
      const row = employerRows.find((item) => item.slug === employer.slug);
      if (!row || row.name !== employer.name || row.websiteUrl !== employer.websiteUrl || row.verificationUrl !== employer.verificationUrl) stop("An employer conflicts with the approved catalog.");
      await tx.update(jobEmployers).set({ verifiedAt, updatedAt: verifiedAt }).where(eq(jobEmployers.id, row.id));
    }

    for (const source of catalog.sources) {
      const employer = employerRows.find((item) => item.slug === source.employerSlug);
      if (!employer) stop("A source employer is missing.");
      await tx.insert(jobSources).values({
        canonicalUrl: source.canonicalUrl, employerId: employer.id, externalSourceId: source.externalSourceId,
        isActive: true, lastVerifiedAt: verifiedAt, provider: source.provider, verificationUrl: source.verificationUrl, updatedAt: verifiedAt,
      }).onConflictDoNothing();
    }
    const sourceRows = await tx.select({
      canonicalUrl: jobSources.canonicalUrl, employerId: jobSources.employerId, externalSourceId: jobSources.externalSourceId,
      id: jobSources.id, provider: jobSources.provider, verificationUrl: jobSources.verificationUrl,
    }).from(jobSources).where(or(...catalog.sources.map((source) => and(eq(jobSources.provider, source.provider), eq(jobSources.externalSourceId, source.externalSourceId)))));
    if (sourceRows.length !== catalog.sources.length) stop("Job source registration did not reach the approved state.");
    for (const source of catalog.sources) {
      const employer = employerRows.find((item) => item.slug === source.employerSlug);
      const row = sourceRows.find((item) => item.provider === source.provider && item.externalSourceId === source.externalSourceId);
      if (!row || !employer || row.employerId !== employer.id || row.canonicalUrl !== source.canonicalUrl || row.verificationUrl !== source.verificationUrl) stop("A job source conflicts with the approved catalog.");
      await tx.update(jobSources).set({ isActive: true, lastVerifiedAt: verifiedAt, updatedAt: verifiedAt }).where(eq(jobSources.id, row.id));
    }

    const before = planInitialJobs(await existingRows(tx), catalog.jobs);
    for (const job of before.missing) {
      const source = sourceRows.find((item) => item.externalSourceId === job.sourceExternalId);
      if (!source) stop("A job source row is missing.");
      const record = { ...job };
      delete record.sourceExternalId;
      await tx.insert(jobs).values({
        ...record,
        applicationDeadline: job.applicationDeadline ? new Date(job.applicationDeadline) : null,
        collectedAt: verifiedAt,
        contentHash: hashInitialJob(job),
        lastVerifiedAt: verifiedAt,
        providerUpdatedAt: job.providerUpdatedAt ? new Date(job.providerUpdatedAt) : null,
        publishedAt: job.publishedAt ? new Date(job.publishedAt) : null,
        remoteCountries: job.remoteCountries ? [...job.remoteCountries] : null,
        responsibilities: [...job.responsibilities], requirements: [...job.requirements], skills: [...job.skills], certifications: [...job.certifications],
        sourceId: source.id,
        updatedAt: verifiedAt,
      });
    }
    for (const job of catalog.jobs) {
      const source = sourceRows.find((item) => item.externalSourceId === job.sourceExternalId);
      if (source) await tx.update(jobs).set({ lastVerifiedAt: verifiedAt, status: "open", updatedAt: verifiedAt }).where(and(eq(jobs.sourceId, source.id), eq(jobs.externalId, job.externalId)));
    }
    const after = planInitialJobs(await existingRows(tx), catalog.jobs);
    if (after.missing.length !== 0 || after.retained.length !== catalog.jobs.length) stop("Job import did not reach the approved idempotent state.");
    return { inserted: before.missing.length, retained: before.retained.length };
  });
}

async function confirmProduction() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) stop("Production import requires an interactive terminal.");
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`Type exactly: ${jobsImportConfig.productionConfirmation}\n> `);
    if (answer !== jobsImportConfig.productionConfirmation) stop("Production job import confirmation did not match.");
  } finally { readline.close(); }
}

function assertUnrelatedCounts(before, after) {
  for (const key of ["sources", "source_items", "stories", "story_source_items", "collection_runs"]) {
    if (Number(before[key]) !== Number(after[key])) stop("An unrelated application table changed during job import.");
  }
}

async function main() {
  const command = parseJobsImportCommand(process.argv.slice(2));
  const production = command.environment === "production";
  const credentialFile = production ? productionMigrationConfig.credentialFile : sourceCatalogConfig.developmentCredentialFile;
  assertIgnored(credentialFile);
  const credential = production ? await loadProductionCredential(projectRoot) : await loadDevelopmentCredential(projectRoot);
  const expectedEndpoint = production ? jobsImportConfig.productionEndpoint : jobsImportConfig.developmentEndpoint;
  if (credential.endpoint !== expectedEndpoint || credential.database !== jobsImportConfig.database) stop("The direct credential does not match the selected environment.");

  const pool = new Pool({ connectionString: credential.connectionString, connectionTimeoutMillis: 15_000, max: 1 });
  let client;
  try {
    client = await pool.connect();
    await client.query("SET statement_timeout='30s'");
    await client.query("SET lock_timeout='5s'");
    const before = await inspect(client, production);
    const liveCount = await verifyLiveListings();
    if (liveCount !== catalog.jobs.length) stop("Not every approved vacancy was verified live.");
    console.log(`${command.environment} preflight passed: exact endpoint, live provider records, migration history, and authentication boundary.`);
    console.log(`Verified vacancies: ${liveCount}; already present: ${before.plan.retained.length}; pending: ${before.plan.missing.length}.`);
    if (command.mode === "preflight") return;
    if (production) await confirmProduction();
    const repeated = await inspect(client, production);
    const result = await writeCatalog(client);
    const after = await inspect(client, production);
    assertUnrelatedCounts(repeated.counts, after.counts);
    if (repeated.auth.fingerprint !== after.auth.fingerprint) stop("The managed authentication catalog changed during job import.");
    console.log(`Job import succeeded: ${result.inserted} inserted; ${result.retained} retained without duplication.`);
    console.log("News data, collection history, and managed authentication were unchanged.");
  } finally { client?.release(); await pool.end().catch(() => undefined); }
}

main().catch((error) => {
  if (error instanceof JobsImportGuardError) console.error(`Jobs import stopped: ${error.message}`);
  else console.error("Jobs import failed without exposing provider or database diagnostics.");
  process.exitCode = 1;
});
