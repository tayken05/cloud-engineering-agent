import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { Pool } from "@neondatabase/serverless";
import { inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import { sources } from "../src/server/db/schema.ts";
import { TRUSTED_SOURCE_CATALOG } from "../src/server/sources/trusted-source-catalog.ts";
import { loadProductionCredential } from "./production-migration-guard.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";
import {
  loadDevelopmentCredential,
  parseSourceCatalogCommand,
  planSourceCatalog,
  sourceCatalogConfig,
  SourceCatalogGuardError,
  validateTrustedSourceCatalog,
} from "./source-catalog-guard.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = validateTrustedSourceCatalog(TRUSTED_SOURCE_CATALOG);

function stop(message) {
  throw new SourceCatalogGuardError(message);
}

function assertCredentialFileIsIgnored(file) {
  const result = spawnSync("git", ["check-ignore", "--quiet", "--", file], {
    cwd: projectRoot,
    stdio: "ignore",
  });
  if (result.status !== 0) stop(`${file} must be excluded by Git before use.`);
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function getAuthCatalog(client) {
  const tables = await client.query(`
    SELECT c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'neon_auth' AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  `);
  const columns = await client.query(`
    SELECT c.relname AS table_name, a.attnum AS column_position,
      a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS data_type,
      a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS column_default
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'neon_auth' AND c.relkind IN ('r', 'p')
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum
  `);
  const constraints = await client.query(`
    SELECT c.relname AS table_name, con.conname AS constraint_name,
      con.contype AS constraint_type, pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'neon_auth'
    ORDER BY c.relname, con.conname
  `);
  const indexes = await client.query(`
    SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition
    FROM pg_catalog.pg_indexes WHERE schemaname = 'neon_auth'
    ORDER BY tablename, indexname
  `);
  return {
    fingerprint: fingerprint({
      columns: columns.rows,
      constraints: constraints.rows,
      indexes: indexes.rows,
      tables: tables.rows,
    }),
    tableCount: tables.rowCount,
  };
}

async function getApplicationCounts(client) {
  const result = await client.query(`
    SELECT
      (SELECT count(*)::integer FROM public.sources) AS sources,
      (SELECT count(*)::integer FROM public.source_items) AS source_items,
      (SELECT count(*)::integer FROM public.stories) AS stories,
      (SELECT count(*)::integer FROM public.story_source_items) AS story_source_items
  `);
  return result.rows[0];
}

function assertUnchangedNonSourceCounts(before, after) {
  for (const key of ["source_items", "stories", "story_source_items"]) {
    if (before[key] !== after[key]) stop("A non-source application table changed unexpectedly.");
  }
}

async function selectCatalogRows(db) {
  const keys = catalog.map((source) => source.key);
  const urls = catalog.map((source) => source.canonicalUrl);
  return db
    .select({
      canonicalUrl: sources.canonicalUrl,
      description: sources.description,
      id: sources.id,
      key: sources.key,
      kind: sources.kind,
      name: sources.name,
      primaryTopic: sources.primaryTopic,
    })
    .from(sources)
    .where(or(inArray(sources.key, keys), inArray(sources.canonicalUrl, urls)));
}

async function inspect(client, production) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    const identity = await client.query(`
      SELECT current_database() AS database_name, current_schema() AS current_schema,
        current_schemas(false) AS active_schemas
    `);
    const current = identity.rows[0];
    if (current?.database_name !== sourceCatalogConfig.database || current?.current_schema !== "public") {
      stop("The database identity or active application schema is unexpected.");
    }
    if (current.active_schemas?.includes("neon_auth")) {
      stop("The managed authentication schema must not be in the active search path.");
    }

    const history = await client.query(`
      SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id
    `);
    if (
      history.rowCount !== 1 ||
      history.rows[0]?.hash !== productionMigrationConfig.migrationSha256 ||
      Number(history.rows[0]?.created_at) !== productionMigrationConfig.migrationTimestamp
    ) {
      stop("The database migration history does not match the approved initial schema.");
    }

    const appTables = await client.query(`
      SELECT c.relname FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname
    `, [productionMigrationConfig.applicationTables]);
    if (appTables.rowCount !== productionMigrationConfig.applicationTables.length) {
      stop("The required application tables are not present.");
    }

    const authCatalog = await getAuthCatalog(client);
    if (production && authCatalog.tableCount !== productionMigrationConfig.expectedAuthTableCount) {
      stop("The production authentication catalog differs from the verified baseline.");
    }
    const db = drizzle(client);
    const existing = await selectCatalogRows(db);
    const plan = planSourceCatalog(existing, catalog);
    const counts = await getApplicationCounts(client);
    await client.query("COMMIT");
    return { authCatalog, counts, existingCount: catalog.length - plan.missing.length, missingCount: plan.missing.length };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function insertCatalog(client) {
  const db = drizzle(client);
  return db.transaction(async (transaction) => {
    const existing = await selectCatalogRows(transaction);
    const plan = planSourceCatalog(existing, catalog);
    const inserted = plan.missing.length === 0
      ? []
      : await transaction
          .insert(sources)
          .values(plan.missing)
          .onConflictDoNothing()
          .returning({ key: sources.key });
    const finalRows = await selectCatalogRows(transaction);
    const finalPlan = planSourceCatalog(finalRows, catalog);
    if (finalPlan.missing.length !== 0 || finalRows.length !== catalog.length) {
      stop("The source catalog did not reach the approved idempotent state.");
    }
    return { insertedCount: inserted.length, retainedCount: catalog.length - inserted.length };
  });
}

async function confirmProduction() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    stop("Production source registration requires an interactive terminal.");
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(
      `Type exactly: ${sourceCatalogConfig.productionConfirmation}\n> `,
    );
    if (answer !== sourceCatalogConfig.productionConfirmation) {
      stop("Production source registration confirmation did not match.");
    }
  } finally {
    readline.close();
  }
}

async function main() {
  const command = parseSourceCatalogCommand(process.argv.slice(2));
  const production = command.environment === "production";
  const credentialFile = production
    ? productionMigrationConfig.credentialFile
    : sourceCatalogConfig.developmentCredentialFile;
  assertCredentialFileIsIgnored(credentialFile);
  const credential = production
    ? await loadProductionCredential(projectRoot)
    : await loadDevelopmentCredential(projectRoot);
  const expectedEndpoint = production
    ? sourceCatalogConfig.productionEndpoint
    : sourceCatalogConfig.developmentEndpoint;
  if (credential.endpoint !== expectedEndpoint || credential.database !== sourceCatalogConfig.database) {
    stop("The credential does not match the selected approved environment.");
  }

  const pool = new Pool({
    connectionString: credential.connectionString,
    connectionTimeoutMillis: 15_000,
    max: 1,
  });
  let client;
  try {
    client = await pool.connect();
    await client.query("SET statement_timeout = '15s'");
    await client.query("SET lock_timeout = '5s'");
    const before = await inspect(client, production);
    console.log(
      `${command.environment} preflight passed: endpoint allowlist, database, migration history, catalog conflicts, and authentication boundary.`,
    );
    console.log(`Approved sources already present: ${before.existingCount}; pending: ${before.missingCount}.`);
    if (command.mode === "preflight") return;

    if (production) await confirmProduction();
    const repeated = await inspect(client, production);
    const result = await insertCatalog(client);
    const after = await inspect(client, production);
    assertUnchangedNonSourceCounts(repeated.counts, after.counts);
    if (repeated.authCatalog.fingerprint !== after.authCatalog.fingerprint) {
      stop("The managed authentication catalog changed unexpectedly.");
    }
    console.log(`Source registration succeeded: ${result.insertedCount} inserted; ${result.retainedCount} already matched.`);
    console.log("Non-source application tables and the managed authentication catalog were unchanged.");
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  if (error instanceof SourceCatalogGuardError) {
    console.error(`Source catalog operation stopped: ${error.message}`);
  } else {
    console.error("Source catalog operation failed without exposing provider diagnostics.");
  }
  process.exitCode = 1;
});
