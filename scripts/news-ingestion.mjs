import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { Pool } from "@neondatabase/serverless";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import { sources } from "../src/server/db/schema.ts";
import { VERIFIED_FEEDS } from "../src/server/ingestion/feed-catalog.ts";
import { collectFeedsWithRetry } from "../src/server/ingestion/feed-retry.ts";
import { createCollectionRunStore } from "../src/server/ingestion/collection-store.ts";
import { runNewsCollection } from "../src/server/ingestion/run-collection.ts";
import { loadProductionCredential } from "./production-migration-guard.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";
import { migrationHistoryMatches } from "./migration-history-guard.mjs";
import {
  loadDevelopmentCredential,
  sourceCatalogConfig,
} from "./source-catalog-guard.mjs";
import {
  NewsIngestionGuardError,
  newsIngestionConfig,
  parseNewsIngestionCommand,
  validateFeedCatalog,
} from "./news-ingestion-guard.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const feedConfigs = validateFeedCatalog(VERIFIED_FEEDS);

function stop(message) {
  throw new NewsIngestionGuardError(message);
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
  return Object.freeze({
    fingerprint: fingerprint({
      columns: columns.rows,
      constraints: constraints.rows,
      indexes: indexes.rows,
      tables: tables.rows,
    }),
    tableCount: tables.rowCount,
  });
}

async function getProtectedCounts(client) {
  const result = await client.query(`
    SELECT
      (SELECT count(*)::integer FROM public.sources) AS sources,
      (SELECT count(*)::integer FROM public.stories) AS stories,
      (SELECT count(*)::integer FROM public.story_source_items) AS story_source_items
  `);
  return result.rows[0];
}

async function inspectDatabase(client, production) {
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
    const history = await client.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id");
    if (!migrationHistoryMatches(history.rows)) {
      stop("The database migration history does not match the approved schema migrations.");
    }
    const authCatalog = await getAuthCatalog(client);
    if (production && authCatalog.tableCount !== productionMigrationConfig.expectedAuthTableCount) {
      stop("The production authentication catalog differs from the verified baseline.");
    }
    const counts = await getProtectedCounts(client);
    await client.query("COMMIT");
    return { authCatalog, counts };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function selectFeedSources(db) {
  return db
    .select({
      id: sources.id,
      isActive: sources.isActive,
      key: sources.key,
      primaryTopic: sources.primaryTopic,
    })
    .from(sources)
    .where(inArray(sources.key, feedConfigs.map((config) => config.sourceKey)));
}

function assertFeedSources(rows) {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  for (const config of feedConfigs) {
    const source = byKey.get(config.sourceKey);
    if (!source || !source.isActive || source.primaryTopic !== config.topic) {
      stop("A configured feed does not match an active registered source and topic.");
    }
  }
  if (rows.length !== feedConfigs.length) stop("The registered feed-source set is incomplete.");
  return byKey;
}

async function verifyStoredItems(client, sourceKeys) {
  const result = await client.query(`
    SELECT s.key, count(si.id)::integer AS item_count
    FROM public.sources s
    LEFT JOIN public.source_items si ON si.source_id = s.id
    WHERE s.key = ANY($1::text[])
    GROUP BY s.key
    ORDER BY s.key
  `, [sourceKeys]);
  const duplicates = await client.query(`
    SELECT count(*)::integer AS duplicate_groups FROM (
      SELECT source_id, external_id FROM public.source_items
      WHERE external_id IS NOT NULL GROUP BY source_id, external_id HAVING count(*) > 1
      UNION ALL
      SELECT source_id, canonical_url FROM public.source_items
      GROUP BY source_id, canonical_url HAVING count(*) > 1
    ) duplicate_identities
  `);
  if (Number(duplicates.rows[0]?.duplicate_groups) !== 0) {
    stop("Duplicate source-item identities were detected after ingestion.");
  }
  return result.rows;
}

async function confirmProduction() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    stop("Production news ingestion requires an interactive terminal.");
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`Type exactly: ${newsIngestionConfig.productionConfirmation}\n> `);
    if (answer !== newsIngestionConfig.productionConfirmation) {
      stop("Production news ingestion confirmation did not match.");
    }
  } finally {
    readline.close();
  }
}

async function collectApprovedFeeds(signal) {
  const collection = await collectFeedsWithRetry(feedConfigs, { signal });
  for (const failure of collection.failures) {
    console.warn(`Feed unavailable (${failure.sourceKey}): ${failure.reason}`);
  }
  if (collection.successes.length < newsIngestionConfig.minimumSuccessfulFeeds) {
    stop("Too few approved feeds completed safely; no source-item write is allowed.");
  }
  const itemCount = collection.successes.reduce(
    (total, result) => total + result.feed.items.length,
    0,
  );
  console.log(
    `Feed validation passed: ${collection.successes.length} publishers and ${itemCount} bounded items.`,
  );
  return collection;
}

async function verifyRunRecord(client, result) {
  const record = await client.query(`
    SELECT status, sources_attempted, sources_succeeded, sources_failed,
      items_inserted, items_updated, items_unchanged, lease_token, lease_expires_at
    FROM public.collection_runs WHERE id = $1
  `, [result.runId]);
  const row = record.rows[0];
  if (
    record.rowCount !== 1 ||
    row.status !== result.status ||
    Number(row.sources_succeeded) !== result.successfulSources ||
    Number(row.sources_failed) !== result.failedSources ||
    Number(row.items_inserted) !== result.insertedItems ||
    Number(row.items_updated) !== result.updatedItems ||
    Number(row.items_unchanged) !== result.unchangedItems ||
    row.lease_token !== null ||
    row.lease_expires_at !== null
  ) {
    stop("The durable collection-run record does not match the completed operation.");
  }
}

async function main() {
  const command = parseNewsIngestionCommand(process.argv.slice(2));
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

  const preflightPool = new Pool({
    connectionString: credential.connectionString,
    connectionTimeoutMillis: 15_000,
    max: 1,
  });
  let before;
  try {
    const client = await preflightPool.connect();
    try {
      await client.query("SET statement_timeout = '20s'");
      await client.query("SET lock_timeout = '5s'");
      const db = drizzle(client);
      assertFeedSources(await selectFeedSources(db));
      before = await inspectDatabase(client, production);
      const existingItems = await verifyStoredItems(
        client,
        feedConfigs.map((config) => config.sourceKey),
      );
      const existingItemCount = existingItems.reduce(
        (total, row) => total + Number(row.item_count),
        0,
      );
      console.log(`${command.environment} preflight passed: endpoint, database, migration, sources, and authentication boundary.`);
      console.log(`Existing stored items across configured publishers: ${existingItemCount}; duplicate identity groups: 0.`);
      console.log(existingItems.map((row) => `${row.key}=${row.item_count}`).join(", "));
    } finally {
      client.release();
    }
  } finally {
    await preflightPool.end().catch(() => undefined);
  }

  if (command.mode === "preflight") {
    await collectApprovedFeeds();
    return;
  }
  if (production) await confirmProduction();

  const store = await createCollectionRunStore({
    connectionString: credential.connectionString,
    expectedEndpoint,
    mode: "direct",
  });
  const result = await runNewsCollection({
    collect: collectApprovedFeeds,
    store,
    trigger: "manual",
  });
  if (result.status === "failed" || result.status === "skipped") {
    stop(`The controlled collection ended with status ${result.status}.`);
  }

  const postflightPool = new Pool({
    connectionString: credential.connectionString,
    connectionTimeoutMillis: 15_000,
    max: 1,
  });
  try {
    const client = await postflightPool.connect();
    try {
      await client.query("SET statement_timeout = '20s'");
      await client.query("SET lock_timeout = '5s'");
      const after = await inspectDatabase(client, production);
      if (
        before.counts.sources !== after.counts.sources ||
        before.counts.stories !== after.counts.stories ||
        before.counts.story_source_items !== after.counts.story_source_items
      ) {
        stop("A protected application table count changed unexpectedly.");
      }
      if (before.authCatalog.fingerprint !== after.authCatalog.fingerprint) {
        stop("The managed authentication catalog changed unexpectedly.");
      }
      await verifyRunRecord(client, result);
      const stored = await verifyStoredItems(
        client,
        feedConfigs.map((config) => config.sourceKey),
      );
      const totalStored = stored.reduce((total, row) => total + Number(row.item_count), 0);
      console.log(
        `News ingestion succeeded: ${result.insertedItems} inserted, ${result.updatedItems} updated, ${result.unchangedItems} seen unchanged.`,
      );
      console.log(`Verified stored items across connected publishers: ${totalStored}.`);
      console.log("The durable run record is complete; stories, evidence links, source count, and managed authentication were unchanged.");
    } finally {
      client.release();
    }
  } finally {
    await postflightPool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  if (error instanceof NewsIngestionGuardError) {
    console.error(`News ingestion stopped: ${error.message}`);
  } else {
    console.error("News ingestion failed without exposing provider or database diagnostics.");
  }
  process.exitCode = 1;
});
