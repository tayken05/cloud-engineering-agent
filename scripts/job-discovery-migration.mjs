import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { approvedMigrationHistory } from "./migration-history-guard.mjs";
import { jobDiscoveryMigrationConfig as config } from "./job-discovery-migration.config.mjs";
import { JobDiscoveryMigrationGuardError, parseJobDiscoveryMigrationCommand, validateJobDiscoveryMigration } from "./job-discovery-migration-guard.mjs";
import { loadProductionCredential } from "./production-migration-guard.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";
import { loadDevelopmentCredential, sourceCatalogConfig } from "./source-catalog-guard.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function stop(message) { throw new JobDiscoveryMigrationGuardError(message); }
function assertIgnored(file) {
  if (spawnSync("git", ["check-ignore", "--quiet", "--", file], { cwd: projectRoot, stdio: "ignore" }).status !== 0) stop(`${file} must be ignored by Git.`);
}

async function verifyArtifacts() {
  const [sql, journalText] = await Promise.all([
    readFile(path.join(projectRoot, config.migrationFile), "utf8"),
    readFile(path.join(projectRoot, "drizzle/meta/_journal.json"), "utf8"),
  ]);
  let journal;
  try { journal = JSON.parse(journalText); } catch { stop("The Drizzle migration journal is invalid."); }
  return validateJobDiscoveryMigration(sql, journal);
}

async function authFingerprint(client) {
  const tables = await client.query("SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') ORDER BY c.relname");
  const columns = await client.query("SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum");
  return { fingerprint: createHash("sha256").update(JSON.stringify({ columns: columns.rows, tables: tables.rows })).digest("hex"), tableCount: tables.rowCount };
}

function historyMatches(rows, length) {
  return rows.length === length && rows.every((row, index) => row.hash === approvedMigrationHistory[index]?.hash && Number(row.created_at) === approvedMigrationHistory[index]?.timestamp);
}

async function inspect(client, production) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    const identity = (await client.query("SELECT current_database() AS database_name,current_schema() AS current_schema,current_schemas(false) AS schemas")).rows[0];
    if (identity?.database_name !== "neondb" || identity.current_schema !== "public" || identity.schemas?.includes("neon_auth")) stop("The database identity or schema search path is unsafe.");
    const history = (await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
    if (!historyMatches(history, 3) && !historyMatches(history, 4)) stop("Migration history does not match the reviewed baseline.");
    const applied = history.length === 4;
    const tableExists = Number((await client.query("SELECT count(*)::integer AS count FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='job_discovery_runs' AND c.relkind IN ('r','p')")).rows[0]?.count) === 1;
    if (tableExists !== applied) stop("Job-discovery objects conflict with migration history.");
    const counts = (await client.query(`SELECT
      (SELECT count(*)::integer FROM public.sources) sources,
      (SELECT count(*)::integer FROM public.source_items) source_items,
      (SELECT count(*)::integer FROM public.collection_runs) collection_runs,
      (SELECT count(*)::integer FROM public.job_employers) job_employers,
      (SELECT count(*)::integer FROM public.job_sources) job_sources,
      (SELECT count(*)::integer FROM public.jobs) jobs`)).rows[0];
    const auth = await authFingerprint(client);
    if (production && auth.tableCount !== productionMigrationConfig.expectedAuthTableCount) stop("The managed authentication table count differs from the baseline.");
    await client.query("COMMIT");
    return { applied, auth, counts };
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
}

async function verifyAfter(client, before, production) {
  const after = await inspect(client, production);
  if (!after.applied) stop("The job-discovery migration was not recorded.");
  for (const [key, value] of Object.entries(before.counts)) if (Number(value) !== Number(after.counts[key])) stop("An existing application table count changed during migration.");
  if (before.auth.fingerprint !== after.auth.fingerprint) stop("The managed authentication catalog changed during migration.");
  const catalog = (await client.query(`SELECT
    (SELECT count(*)::integer FROM information_schema.columns WHERE table_schema='public' AND table_name='job_discovery_runs') run_columns,
    (SELECT count(*)::integer FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name=ANY($1::text[])) lifecycle_columns,
    (SELECT count(*)::integer FROM information_schema.columns WHERE table_schema='public' AND table_name='job_sources' AND column_name=ANY($2::text[])) source_columns,
    (SELECT count(*)::integer FROM pg_catalog.pg_indexes WHERE schemaname='public' AND indexname=ANY($3::text[])) indexes,
    (SELECT count(*)::integer FROM pg_catalog.pg_constraint WHERE conname=ANY($4::text[])) constraints,
    (SELECT count(*)::integer FROM public.job_discovery_runs) runs`, [
      ["last_seen_at", "last_checked_at", "missing_observation_count", "missing_since", "closed_at", "closure_reason"],
      ["last_attempted_sync_at", "last_successful_sync_at", "consecutive_failures"],
      ["job_discovery_runs_single_running_idx", "job_discovery_runs_status_finished_idx", "job_discovery_runs_started_idx", "jobs_status_checked_idx"],
      ["job_discovery_runs_counts_nonnegative", "job_discovery_runs_source_counts_consistent", "job_discovery_runs_lease_state", "job_discovery_runs_finished_after_start", "job_sources_failures_nonnegative", "jobs_checked_after_seen", "jobs_missing_state", "jobs_missing_count_nonnegative", "jobs_closure_state"],
    ])).rows[0];
  if (Number(catalog.run_columns) !== 22 || Number(catalog.lifecycle_columns) !== 6 || Number(catalog.source_columns) !== 3 || Number(catalog.indexes) !== 4 || Number(catalog.constraints) !== 9 || Number(catalog.runs) !== 0) stop("The migrated catalog does not match the reviewed job-discovery schema.");
}

async function confirmProduction() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) stop("Production migration requires an interactive terminal.");
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`Type exactly: ${config.confirmationPhrase}\n> `);
    if (answer !== config.confirmationPhrase) stop("Production migration confirmation did not match.");
  } finally { readline.close(); }
}

async function main() {
  const command = parseJobDiscoveryMigrationCommand(process.argv.slice(2));
  const production = command.environment === "production";
  await verifyArtifacts();
  const credentialFile = production ? productionMigrationConfig.credentialFile : sourceCatalogConfig.developmentCredentialFile;
  assertIgnored(credentialFile);
  const credential = production ? await loadProductionCredential(projectRoot) : await loadDevelopmentCredential(projectRoot);
  const endpoint = production ? productionMigrationConfig.endpoint : sourceCatalogConfig.developmentEndpoint;
  if (credential.endpoint !== endpoint || credential.database !== "neondb") stop("The direct credential does not match the selected environment.");
  const pool = new Pool({ connectionString: credential.connectionString, connectionTimeoutMillis: 15_000, max: 1 });
  let client;
  try {
    client = await pool.connect();
    await client.query("SET statement_timeout='30s'"); await client.query("SET lock_timeout='5s'");
    const before = await inspect(client, production);
    console.log(`${command.environment} preflight passed: exact direct endpoint, migration history, schema boundary, and authentication catalog.`);
    console.log(`Job-discovery migration status: ${before.applied ? "already applied" : "pending"}.`);
    if (command.mode === "preflight") return;
    if (production && !before.applied) await confirmProduction();
    await migrate(drizzle(client), { migrationsFolder: path.join(projectRoot, "drizzle") });
    await verifyAfter(client, before, production);
    console.log("Job-discovery migration verified; existing application rows and managed authentication were unchanged.");
  } finally { client?.release(); await pool.end().catch(() => undefined); }
}

main().catch((error) => {
  if (error instanceof JobDiscoveryMigrationGuardError) console.error(`Job-discovery migration stopped: ${error.message}`);
  else console.error("Job-discovery migration failed without exposing database diagnostics.");
  process.exitCode = 1;
});
