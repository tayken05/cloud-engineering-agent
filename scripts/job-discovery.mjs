import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { Pool } from "@neondatabase/serverless";

import { migrationHistoryMatches } from "./migration-history-guard.mjs";
import { loadProductionCredential } from "./production-migration-guard.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";
import { loadDevelopmentCredential, sourceCatalogConfig } from "./source-catalog-guard.mjs";
import { collectEmployerBoards } from "../src/server/jobs/discovery/collect-boards.ts";
import { VERIFIED_EMPLOYER_BOARDS } from "../src/server/jobs/discovery/employer-registry.ts";
import { runJobDiscovery } from "../src/server/jobs/discovery/run-job-discovery.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const confirmation = "RUN VERIFIED JOB DISCOVERY ON NEON MAIN ep-spring-grass-b7iye83x";

function stop(message) { throw new Error(message); }
function parse(arguments_) {
  if (arguments_.length !== 2 || !new Set(["--development", "--production"]).has(arguments_[0]) || !new Set(["--preflight", "--execute"]).has(arguments_[1])) {
    stop("Choose --development|--production and --preflight|--execute.");
  }
  return { environment: arguments_[0].slice(2), mode: arguments_[1].slice(2) };
}
function assertIgnored(file) {
  if (spawnSync("git", ["check-ignore", "--quiet", "--", file], { cwd: projectRoot, stdio: "ignore" }).status !== 0) stop(`${file} must be ignored by Git.`);
}
async function authFingerprint(client) {
  const rows = await client.query("SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum");
  return createHash("sha256").update(JSON.stringify(rows.rows)).digest("hex");
}
async function inspect(connectionString, production) {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 15_000, max: 1 });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN TRANSACTION READ ONLY");
    const identity = (await client.query("SELECT current_database() database_name,current_schema() current_schema,current_schemas(false) schemas")).rows[0];
    if (identity?.database_name !== "neondb" || identity.current_schema !== "public" || identity.schemas?.includes("neon_auth")) stop("The database identity or search path is unsafe.");
    const history = (await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
    if (!migrationHistoryMatches(history)) stop("The database does not contain exactly the reviewed migration history.");
    const authTables = Number((await client.query("SELECT count(*)::integer count FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p')")).rows[0]?.count);
    if (production && authTables !== productionMigrationConfig.expectedAuthTableCount) stop("The managed authentication catalog differs from its baseline.");
    const counts = (await client.query(`SELECT
      (SELECT count(*)::integer FROM public.jobs) jobs,
      (SELECT count(*)::integer FROM public.job_employers) employers,
      (SELECT count(*)::integer FROM public.job_sources) sources,
      (SELECT count(*)::integer FROM public.source_items) news_items,
      (SELECT count(*)::integer FROM public.collection_runs) news_runs,
      (SELECT count(*)::integer FROM public.job_discovery_runs) discovery_runs,
      (SELECT count(*)::integer FROM public.jobs WHERE status IN ('closed','expired')) inactive_jobs`)).rows[0];
    const auth = await authFingerprint(client);
    await client.query("COMMIT");
    return { auth, counts };
  } catch (error) { await client?.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client?.release(); await pool.end().catch(() => undefined); }
}
async function confirmProduction() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) stop("Production discovery requires an interactive terminal.");
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`Type exactly: ${confirmation}\n> `);
    if (answer !== confirmation) stop("Production discovery confirmation did not match.");
  } finally { readline.close(); }
}

async function main() {
  const command = parse(process.argv.slice(2));
  const production = command.environment === "production";
  const file = production ? productionMigrationConfig.credentialFile : sourceCatalogConfig.developmentCredentialFile;
  assertIgnored(file);
  const credential = production ? await loadProductionCredential(projectRoot) : await loadDevelopmentCredential(projectRoot);
  const endpoint = production ? productionMigrationConfig.endpoint : sourceCatalogConfig.developmentEndpoint;
  if (credential.endpoint !== endpoint || credential.database !== "neondb") stop("Job discovery requires the exact direct connection for the selected environment.");
  const before = await inspect(credential.connectionString, production);
  const collection = await collectEmployerBoards(VERIFIED_EMPLOYER_BOARDS);
  if (collection.successes.length === 0) stop("Every recruiting provider failed; no database changes are allowed.");
  console.log(`${command.environment} preflight passed: exact endpoint, reviewed migration history, authentication boundary, and ${collection.successes.length}/${VERIFIED_EMPLOYER_BOARDS.length} complete boards.`);
  if (command.mode === "preflight") return;
  if (production) await confirmProduction();
  const result = await runJobDiscovery({
    collect: async () => collection, connectionString: credential.connectionString,
    expectedEndpoint: endpoint, mode: "direct", trigger: "manual",
  });
  const after = await inspect(credential.connectionString, production);
  if (before.auth !== after.auth) stop("The managed authentication catalog changed during job discovery.");
  for (const key of ["news_items", "news_runs"]) if (Number(before.counts[key]) !== Number(after.counts[key])) stop("News data changed during job discovery.");
  if (Number(after.counts.discovery_runs) !== Number(before.counts.discovery_runs) + 1) stop("The discovery run was not recorded exactly once.");
  console.log(`Job discovery ${result.status}: ${result.insertedJobs} new, ${result.updatedJobs} updated, ${result.unchangedJobs} unchanged, ${result.closedJobs} closed, ${result.pendingVerificationJobs} pending verification.`);
  console.log("News records and managed authentication were unchanged.");
}

main().catch(() => {
  console.error("Job discovery stopped safely without exposing provider or database diagnostics.");
  process.exitCode = 1;
});
