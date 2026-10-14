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

import { collectionRunsMigrationConfig } from "./collection-runs-migration.config.mjs";
import { jobsMigrationConfig as config } from "./jobs-migration.config.mjs";
import { JobsMigrationGuardError, parseJobsMigrationCommand, validateJobsMigration } from "./jobs-migration-guard.mjs";
import { loadProductionCredential } from "./production-migration-guard.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";
import { loadDevelopmentCredential, sourceCatalogConfig } from "./source-catalog-guard.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function stop(message) {
  throw new JobsMigrationGuardError(message);
}

function assertIgnored(file) {
  const result = spawnSync("git", ["check-ignore", "--quiet", "--", file], { cwd: projectRoot, stdio: "ignore" });
  if (result.status !== 0) stop(`${file} must be ignored by Git.`);
}

async function verifyArtifacts() {
  const [initial, collection, jobs, journalText] = await Promise.all([
    readFile(path.join(projectRoot, productionMigrationConfig.migrationFile), "utf8"),
    readFile(path.join(projectRoot, collectionRunsMigrationConfig.migrationFile), "utf8"),
    readFile(path.join(projectRoot, config.migrationFile), "utf8"),
    readFile(path.join(projectRoot, productionMigrationConfig.migrationJournal), "utf8"),
  ]);
  if (createHash("sha256").update(initial).digest("hex") !== productionMigrationConfig.migrationSha256) stop("The initial migration changed.");
  if (createHash("sha256").update(collection).digest("hex") !== collectionRunsMigrationConfig.migrationSha256) stop("The collection-run migration changed.");
  let journal;
  try { journal = JSON.parse(journalText); } catch { stop("The Drizzle migration journal is invalid."); }
  return validateJobsMigration(jobs, journal);
}

async function authFingerprint(client) {
  const tables = await client.query("SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') ORDER BY c.relname");
  const columns = await client.query("SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum");
  const constraints = await client.query("SELECT c.relname,con.conname,con.contype,pg_get_constraintdef(con.oid,true) FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='neon_auth' ORDER BY c.relname,con.conname");
  const indexes = await client.query("SELECT tablename,indexname,indexdef FROM pg_catalog.pg_indexes WHERE schemaname='neon_auth' ORDER BY tablename,indexname");
  return Object.freeze({
    fingerprint: createHash("sha256").update(JSON.stringify({ columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows, tables: tables.rows })).digest("hex"),
    tableCount: tables.rowCount,
  });
}

async function inspect(client, production) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    const identity = await client.query("SELECT current_database() AS database_name,current_schema() AS current_schema,current_schemas(false) AS schemas");
    const current = identity.rows[0];
    if (current?.database_name !== "neondb" || current.current_schema !== "public" || current.schemas?.includes("neon_auth")) stop("The database identity or schema search path is unsafe.");
    const history = await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id");
    if (history.rowCount < 2 || history.rowCount > 3 ||
      history.rows[0]?.hash !== productionMigrationConfig.migrationSha256 || Number(history.rows[0]?.created_at) !== productionMigrationConfig.migrationTimestamp ||
      history.rows[1]?.hash !== collectionRunsMigrationConfig.migrationSha256 || Number(history.rows[1]?.created_at) !== collectionRunsMigrationConfig.migrationTimestamp) {
      stop("The existing migration history does not match the approved baseline.");
    }
    const applied = history.rowCount === 3;
    if (applied && (history.rows[2]?.hash !== config.migrationSha256 || Number(history.rows[2]?.created_at) !== config.migrationTimestamp)) stop("The jobs migration history is unexpected.");
    const objects = await client.query(`
      SELECT 'table' AS kind,c.relname AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname=ANY($1::text[])
      UNION ALL
      SELECT 'enum',t.typname FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' AND t.typtype='e' AND t.typname=ANY($2::text[])
      ORDER BY kind,name`, [config.tables, config.enumTypes]);
    if ((!applied && objects.rowCount !== 0) || (applied && objects.rowCount !== config.tables.length + config.enumTypes.length)) stop("Jobs objects conflict with migration history.");
    const existing = await client.query(`SELECT
      (SELECT count(*)::integer FROM public.sources) AS sources,
      (SELECT count(*)::integer FROM public.source_items) AS source_items,
      (SELECT count(*)::integer FROM public.stories) AS stories,
      (SELECT count(*)::integer FROM public.story_source_items) AS story_source_items,
      (SELECT count(*)::integer FROM public.collection_runs) AS collection_runs`);
    const jobCounts = applied ? (await client.query(`SELECT
      (SELECT count(*)::integer FROM public.job_employers) AS job_employers,
      (SELECT count(*)::integer FROM public.job_sources) AS job_sources,
      (SELECT count(*)::integer FROM public.jobs) AS jobs`)).rows[0] : { job_employers: 0, job_sources: 0, jobs: 0 };
    const auth = await authFingerprint(client);
    if (production && auth.tableCount !== productionMigrationConfig.expectedAuthTableCount) stop("The managed authentication table count differs from the baseline.");
    await client.query("COMMIT");
    return { applied, auth, counts: { ...existing.rows[0], ...jobCounts } };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function verifyAfter(client, before, production) {
  const after = await inspect(client, production);
  if (!after.applied) stop("The jobs migration was not recorded.");
  for (const table of ["sources", "source_items", "stories", "story_source_items", "collection_runs"]) {
    if (Number(before.counts[table]) !== Number(after.counts[table])) stop("An existing application table count changed during migration.");
  }
  if (after.auth.fingerprint !== before.auth.fingerprint) stop("The managed authentication catalog changed during migration.");
  if (Number(after.counts.job_employers) !== 0 || Number(after.counts.job_sources) !== 0 || Number(after.counts.jobs) !== 0) stop("The schema migration unexpectedly inserted job data.");
  const catalog = await client.query(`SELECT
    (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[]))::integer AS columns,
    (SELECT count(*) FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND con.conname=ANY($2::text[]))::integer AS constraints,
    (SELECT count(*) FROM pg_catalog.pg_indexes WHERE schemaname='public' AND tablename=ANY($1::text[]) AND indexname=ANY($3::text[]))::integer AS indexes`, [config.tables, config.constraints, config.explicitIndexes]);
  const row = catalog.rows[0];
  if (Number(row?.columns) !== 58 || Number(row?.constraints) !== config.constraints.length || Number(row?.indexes) !== config.explicitIndexes.length) stop("The jobs catalog does not match the reviewed schema.");
  return after;
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
  const command = parseJobsMigrationCommand(process.argv.slice(2));
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
    await client.query("SET statement_timeout='30s'");
    await client.query("SET lock_timeout='5s'");
    const before = await inspect(client, production);
    console.log(`${command.environment} preflight passed: exact direct endpoint, migration history, schema boundary, and authentication catalog.`);
    console.log(`Jobs migration status: ${before.applied ? "already applied" : "pending"}.`);
    if (command.mode === "preflight") return;
    if (production && !before.applied) await confirmProduction();
    await migrate(drizzle(client), { migrationsFolder: path.join(projectRoot, "drizzle") });
    await verifyAfter(client, before, production);
    console.log("Jobs migration verified: 3 tables, 7 enums, 58 columns, 34 named constraints, and 8 explicit indexes.");
    console.log("Existing application rows and the managed authentication catalog were unchanged.");
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  if (error instanceof JobsMigrationGuardError) console.error(`Jobs migration stopped: ${error.message}`);
  else console.error("Jobs migration failed without exposing database diagnostics.");
  process.exitCode = 1;
});
