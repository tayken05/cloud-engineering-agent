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

import { collectionRunsMigrationConfig as config } from "./collection-runs-migration.config.mjs";
import {
  CollectionRunsMigrationGuardError,
  parseCollectionRunsMigrationCommand,
  validateCollectionRunsMigration,
} from "./collection-runs-migration-guard.mjs";
import { loadProductionCredential } from "./production-migration-guard.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";
import {
  loadDevelopmentCredential,
  sourceCatalogConfig,
} from "./source-catalog-guard.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function stop(message) {
  throw new CollectionRunsMigrationGuardError(message);
}

function assertIgnored(file) {
  const result = spawnSync("git", ["check-ignore", "--quiet", "--", file], {
    cwd: projectRoot,
    stdio: "ignore",
  });
  if (result.status !== 0) stop(`${file} must be ignored by Git.`);
}

async function verifyArtifacts() {
  const [initialSql, sql, journalText] = await Promise.all([
    readFile(path.join(projectRoot, productionMigrationConfig.migrationFile), "utf8"),
    readFile(path.join(projectRoot, config.migrationFile), "utf8"),
    readFile(path.join(projectRoot, productionMigrationConfig.migrationJournal), "utf8"),
  ]);
  if (createHash("sha256").update(initialSql).digest("hex") !== productionMigrationConfig.migrationSha256) {
    stop("The development-tested initial migration has changed.");
  }
  let journal;
  try {
    journal = JSON.parse(journalText);
  } catch {
    stop("The Drizzle migration journal is invalid.");
  }
  return validateCollectionRunsMigration(sql, journal);
}

async function authFingerprint(client) {
  const [tables, columns, constraints, indexes] = await Promise.all([
    client.query(`SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') ORDER BY c.relname`),
    client.query(`SELECT c.relname, a.attnum, a.attname, format_type(a.atttypid,a.atttypmod), a.attnotnull, pg_get_expr(d.adbin,d.adrelid) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`),
    client.query(`SELECT c.relname, con.conname, con.contype, pg_get_constraintdef(con.oid,true) FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='neon_auth' ORDER BY c.relname,con.conname`),
    client.query(`SELECT tablename,indexname,indexdef FROM pg_catalog.pg_indexes WHERE schemaname='neon_auth' ORDER BY tablename,indexname`),
  ]);
  return Object.freeze({
    fingerprint: createHash("sha256").update(JSON.stringify({
      columns: columns.rows,
      constraints: constraints.rows,
      indexes: indexes.rows,
      tables: tables.rows,
    })).digest("hex"),
    tableCount: tables.rowCount,
  });
}

async function inspect(client, production) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    const identity = await client.query("SELECT current_database() AS database_name, current_schema() AS current_schema, current_schemas(false) AS schemas");
    const current = identity.rows[0];
    if (current?.database_name !== "neondb" || current.current_schema !== "public" || current.schemas?.includes("neon_auth")) {
      stop("The database identity or schema search path is unsafe.");
    }
    const history = await client.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id");
    if (
      history.rowCount < 1 || history.rowCount > 2 ||
      history.rows[0]?.hash !== productionMigrationConfig.migrationSha256 ||
      Number(history.rows[0]?.created_at) !== productionMigrationConfig.migrationTimestamp
    ) {
      stop("The existing Drizzle migration history does not match the tested initial migration.");
    }
    const applied = history.rowCount === 2;
    if (applied && (
      history.rows[1]?.hash !== config.migrationSha256 ||
      Number(history.rows[1]?.created_at) !== config.migrationTimestamp
    )) {
      stop("The collection-run migration history is unexpected.");
    }
    const objects = await client.query(`
      SELECT 'table' AS kind, c.relname AS name FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname='collection_runs'
      UNION ALL
      SELECT 'enum', t.typname FROM pg_catalog.pg_type t
      JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' AND t.typtype='e' AND t.typname = ANY($1::text[])
      ORDER BY kind,name
    `, [["collection_run_status", "collection_run_trigger"]]);
    if ((!applied && objects.rowCount !== 0) || (applied && objects.rowCount !== 3)) {
      stop("The collection-run database objects conflict with migration history.");
    }
    const counts = await client.query(`SELECT
      (SELECT count(*)::integer FROM public.sources) AS sources,
      (SELECT count(*)::integer FROM public.source_items) AS source_items,
      (SELECT count(*)::integer FROM public.stories) AS stories,
      (SELECT count(*)::integer FROM public.story_source_items) AS story_source_items`);
    const collectionRunCount = applied
      ? Number((await client.query("SELECT count(*)::integer AS count FROM public.collection_runs")).rows[0]?.count)
      : 0;
    const auth = await authFingerprint(client);
    if (production && auth.tableCount !== productionMigrationConfig.expectedAuthTableCount) {
      stop("The managed authentication table count differs from the verified baseline.");
    }
    await client.query("COMMIT");
    return Object.freeze({
      applied,
      auth,
      counts: { ...counts.rows[0], collection_runs: collectionRunCount },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function verifyAfter(client, before, production) {
  const after = await inspect(client, production);
  if (!after.applied) stop("The collection-run migration was not recorded.");
  for (const table of ["sources", "source_items", "stories", "story_source_items"]) {
    if (Number(before.counts[table]) !== Number(after.counts[table])) {
      stop("An existing application table count changed during migration.");
    }
  }
  if (after.auth.fingerprint !== before.auth.fingerprint) {
    stop("The managed authentication catalog changed during migration.");
  }
  const catalog = await client.query(`
    SELECT
      (SELECT count(*) FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='collection_runs' AND con.conname = ANY($1::text[]))::integer AS constraints,
      (SELECT count(*) FROM pg_catalog.pg_indexes WHERE schemaname='public' AND tablename='collection_runs')::integer AS indexes,
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='collection_runs')::integer AS columns
  `, [[
    "collection_runs_pkey",
    "collection_runs_counts_nonnegative",
    "collection_runs_source_counts_consistent",
    "collection_runs_lease_state",
    "collection_runs_finished_after_start",
  ]]);
  const counts = catalog.rows[0];
  if (Number(counts?.columns) !== 18 || Number(counts?.constraints) !== 5 || Number(counts?.indexes) !== 4) {
    stop("The collection-run catalog does not match the reviewed schema.");
  }
  return after;
}

async function confirmProduction() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) stop("Production migration requires an interactive terminal.");
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`Type exactly: ${config.confirmationPhrase}\n> `);
    if (answer !== config.confirmationPhrase) stop("Production migration confirmation did not match.");
  } finally {
    readline.close();
  }
}

async function main() {
  const command = parseCollectionRunsMigrationCommand(process.argv.slice(2));
  const production = command.environment === "production";
  await verifyArtifacts();
  const credentialFile = production
    ? productionMigrationConfig.credentialFile
    : sourceCatalogConfig.developmentCredentialFile;
  assertIgnored(credentialFile);
  const credential = production
    ? await loadProductionCredential(projectRoot)
    : await loadDevelopmentCredential(projectRoot);
  const expectedEndpoint = production
    ? productionMigrationConfig.endpoint
    : sourceCatalogConfig.developmentEndpoint;
  if (credential.endpoint !== expectedEndpoint || credential.database !== "neondb") {
    stop("The direct credential does not match the selected database environment.");
  }

  const pool = new Pool({ connectionString: credential.connectionString, connectionTimeoutMillis: 15_000, max: 1 });
  let client;
  try {
    client = await pool.connect();
    await client.query("SET statement_timeout='30s'");
    await client.query("SET lock_timeout='5s'");
    const before = await inspect(client, production);
    console.log(`${command.environment} preflight passed: exact direct endpoint, schema boundary, migration history, and authentication catalog.`);
    console.log(`Collection-run migration status: ${before.applied ? "already applied" : "pending"}.`);
    if (command.mode === "preflight") return;
    if (production && !before.applied) await confirmProduction();
    await migrate(drizzle(client), { migrationsFolder: path.join(projectRoot, "drizzle") });
    await verifyAfter(client, before, production);
    console.log("Collection-run migration verified: 1 table, 2 enums, 5 constraints, 4 indexes, and matching Drizzle history.");
    console.log("Existing application row counts and the managed authentication catalog were unchanged.");
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  if (error instanceof CollectionRunsMigrationGuardError) {
    console.error(`Collection-run migration stopped: ${error.message}`);
  } else {
    console.error("Collection-run migration failed without exposing database diagnostics.");
  }
  process.exitCode = 1;
});
