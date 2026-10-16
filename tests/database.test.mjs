import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

import {
  approvedMigrationHistory,
  migrationHistoryMatches,
} from "../scripts/migration-history-guard.mjs";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { getDatabaseUrl } from "../src/server/db/environment.ts";
import {
  collectionRuns,
  contentDraftRevisions,
  contentDrafts,
  contentIdeas,
  contentMediaAssets,
  contentVisualSpecifications,
  aiContentSuggestions,
  aiGenerationEvidence,
  aiGenerationRuns,
  jobEmployers,
  jobDiscoveryRuns,
  jobs,
  jobSources,
  sources,
  sourceItems,
  stories,
  storySourceItems,
} from "../src/server/db/schema.ts";
import * as schema from "../src/server/db/schema.ts";

const { generateDrizzleJson, generateMigration } = createRequire(import.meta.url)("drizzle-kit/api");

// Offline checks only: no connection or credentials are used.
test("database modules import without requiring a connection URL", () => {
  assert.equal(getTableConfig(sources).name, "sources");
  assert.throws(() => getDatabaseUrl({}), /DATABASE_URL is required/);
});

test("the lazy URL reader accepts PostgreSQL and preserves connection options", () => {
  for (const scheme of ["postgres", "postgresql"]) {
    const value = `${scheme}://db.example.invalid/cloud?sslmode=require`;
    assert.equal(getDatabaseUrl({ DATABASE_URL: ` ${value} ` }), value);
  }
});

test("invalid connection configuration fails without echoing its value", () => {
  for (const value of ["", "  ", "fake-private-value", "https://db.example.invalid/cloud", "postgresql://db.example.invalid/"]) {
    assert.throws(() => getDatabaseUrl({ DATABASE_URL: value }), (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /^DATABASE_URL/);
      if (value.trim()) assert.ok(!error.message.includes(value));
      return true;
    });
  }
});

test("the environment module rejects imports without the server-only condition", () => {
  const result = spawnSync(process.execPath, [
    "--input-type=module", "-e", "await import('./src/server/db/environment.ts')",
  ], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot be imported from a Client Component module/);
});

test("migration snapshot preserves the declared columns, keys, indexes, and foreign keys", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0000_snapshot.json", import.meta.url), "utf8"));
  const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const migration = await readFile(new URL(`../drizzle/${journal.entries[0].tag}.sql`, import.meta.url), "utf8");
  const dialect = new PgDialect();
  for (const table of [sources, sourceItems, stories, storySourceItems]) {
    const declared = getTableConfig(table);
    const stored = snapshot.tables[`public.${declared.name}`];
    assert.ok(stored, `Missing migration table: ${declared.name}`);
    assert.deepEqual(Object.keys(stored.columns).sort(), declared.columns.map((column) => column.name).sort());
    for (const column of declared.columns) {
      const saved = stored.columns[column.name];
      assert.equal(saved.type, column.getSQLType(), `${declared.name}.${column.name} type`);
      assert.equal(saved.notNull, column.notNull, `${declared.name}.${column.name} nullability`);
      assert.equal(saved.primaryKey, column.primary, `${declared.name}.${column.name} primary key`);
    }
    assert.deepEqual(Object.keys(stored.uniqueConstraints).sort(), declared.uniqueConstraints.map((constraint) => constraint.getName()).sort());
    assert.deepEqual(Object.keys(stored.indexes).sort(), declared.indexes.map((entry) => entry.config.name).sort());
    assert.deepEqual(Object.keys(stored.checkConstraints).sort(), declared.checks.map((constraint) => constraint.name).sort());
    assert.deepEqual(Object.keys(stored.compositePrimaryKeys).sort(), declared.primaryKeys.map((key) => key.getName()).sort());
    assert.deepEqual(Object.keys(stored.foreignKeys).sort(), declared.foreignKeys.map((key) => key.getName()).sort());
    for (const constraint of declared.uniqueConstraints) {
      assert.deepEqual(stored.uniqueConstraints[constraint.getName()].columns, constraint.columns.map((column) => column.name));
    }
    for (const key of declared.primaryKeys) {
      assert.deepEqual(stored.compositePrimaryKeys[key.getName()].columns, key.columns.map((column) => column.name));
    }
    for (const entry of declared.indexes) {
      const saved = stored.indexes[entry.config.name];
      assert.deepEqual(saved.columns.map((column) => column.expression), entry.config.columns.map((column) => column.name));
      assert.equal(saved.isUnique, entry.config.unique);
    }
    for (const constraint of declared.checks) {
      const expression = dialect.sqlToQuery(constraint.value).sql;
      assert.equal(stored.checkConstraints[constraint.name].value, expression);
      assert.ok(migration.includes(`CONSTRAINT "${constraint.name}" CHECK (${expression})`));
    }
    for (const key of declared.foreignKeys) {
      const reference = key.reference();
      const saved = stored.foreignKeys[key.getName()];
      assert.equal(saved.tableTo, getTableConfig(reference.foreignTable).name);
      assert.deepEqual(saved.columnsFrom, reference.columns.map((column) => column.name));
      assert.deepEqual(saved.columnsTo, reference.foreignColumns.map((column) => column.name));
      assert.equal(saved.onDelete, "restrict");
    }
  }
});

test("migration history contains only reviewed additive schema entries", async () => {
  const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  assert.deepEqual(journal.entries.map((entry) => entry.tag), [
    "0000_initial_intelligence",
    "0001_collection_runs",
    "0002_jobs_opportunities",
    "0003_job_discovery",
    "0004_content_workspace",
    "0005_ai_content_generation",
    "0006_ai_visual_content",
  ]);
  for (const entry of journal.entries) {
    const migration = await readFile(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), "utf8");
    const statements = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
    assert.ok(statements.length > 0);
    for (const statement of statements) {
      assert.match(statement, /^(CREATE TYPE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX|ALTER TYPE .* ADD VALUE|ALTER TABLE .* ADD (COLUMN|CONSTRAINT))/);
      assert.doesNotMatch(statement, /^(DROP|TRUNCATE|DELETE|INSERT|UPDATE)\b/);
      assert.doesNotMatch(statement, /neon_auth/i);
    }
  }
});

test("operator tooling accepts only the exact applied migration history", () => {
  const rows = approvedMigrationHistory.map((migration) => ({
    created_at: migration.timestamp,
    hash: migration.hash,
  }));
  assert.equal(migrationHistoryMatches(rows), true);
  assert.equal(migrationHistoryMatches(rows.slice(0, 1)), false);
  assert.equal(migrationHistoryMatches(rows.map((row, index) => (
    index === 1 ? { ...row, hash: "unexpected" } : row
  ))), false);
});

test("the collection-run migration matches fresh offline generation from the initial snapshot", async () => {
  // Generate in memory only: no files, credentials, connections, or schema execution.
  const initialSnapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0000_snapshot.json", import.meta.url), "utf8"));
  const monitoringSnapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0001_snapshot.json", import.meta.url), "utf8"));
  const generated = await generateMigration(initialSnapshot, monitoringSnapshot);
  const migration = await readFile(new URL("../drizzle/0001_collection_runs.sql", import.meta.url), "utf8");
  const existing = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
  assert.deepEqual(existing, generated.map((statement) => statement.trim()));
});

test("the monitoring table snapshot matches the declared schema", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0001_snapshot.json", import.meta.url), "utf8"));
  const declared = getTableConfig(collectionRuns);
  const stored = snapshot.tables["public.collection_runs"];
  assert.ok(stored);
  assert.deepEqual(Object.keys(stored.columns).sort(), declared.columns.map((column) => column.name).sort());
  assert.deepEqual(Object.keys(stored.indexes).sort(), declared.indexes.map((index) => index.config.name).sort());
  assert.deepEqual(Object.keys(stored.checkConstraints).sort(), declared.checks.map((check) => check.name).sort());
});

test("the jobs migration matches fresh offline generation from the monitoring snapshot", async () => {
  const previousSnapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0001_snapshot.json", import.meta.url), "utf8"));
  const jobsSnapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0002_snapshot.json", import.meta.url), "utf8"));
  const generated = await generateMigration(previousSnapshot, jobsSnapshot);
  const migration = await readFile(new URL("../drizzle/0002_jobs_opportunities.sql", import.meta.url), "utf8");
  const existing = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
  assert.deepEqual(existing, generated.map((statement) => statement.trim()));
});

test("the job-discovery migration matches fresh offline generation", async () => {
  const previousSnapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0002_snapshot.json", import.meta.url), "utf8"));
  const discoverySnapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0003_snapshot.json", import.meta.url), "utf8"));
  const generated = await generateMigration(previousSnapshot, discoverySnapshot);
  const migration = await readFile(new URL("../drizzle/0003_job_discovery.sql", import.meta.url), "utf8");
  const existing = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
  assert.deepEqual(existing, generated.map((statement) => statement.trim()));
});

test("the content workspace migration matches fresh offline generation", async () => {
  const previousSnapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0003_snapshot.json", import.meta.url), "utf8"));
  const contentSnapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0004_snapshot.json", import.meta.url), "utf8"));
  const generated = await generateMigration(previousSnapshot, contentSnapshot);
  const migration = await readFile(new URL("../drizzle/0004_content_workspace.sql", import.meta.url), "utf8");
  const existing = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
  assert.deepEqual(existing, generated.map((statement) => statement.trim()));
});

test("the AI-content migration matches fresh offline generation", async () => {
  const previousSnapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0004_snapshot.json", import.meta.url), "utf8"));
  const aiSnapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0005_snapshot.json", import.meta.url), "utf8"));
  const generated = await generateMigration(previousSnapshot, aiSnapshot);
  const migration = await readFile(new URL("../drizzle/0005_ai_content_generation.sql", import.meta.url), "utf8");
  const existing = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
  assert.deepEqual(existing, generated.map((statement) => statement.trim()));
});

test("the AI-visual migration matches fresh offline generation", async () => {
  const previousSnapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0005_snapshot.json", import.meta.url), "utf8"));
  const generated = await generateMigration(previousSnapshot, generateDrizzleJson(schema));
  const migration = await readFile(new URL("../drizzle/0006_ai_visual_content.sql", import.meta.url), "utf8");
  const existing = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
  assert.deepEqual(existing, generated.map((statement) => statement.trim()));
});

test("the AI-content snapshot matches owner-scoped run, suggestion, and evidence declarations", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0005_snapshot.json", import.meta.url), "utf8"));
  for (const table of [aiGenerationRuns, aiContentSuggestions, aiGenerationEvidence]) {
    const declared = getTableConfig(table);
    const stored = snapshot.tables[`public.${declared.name}`];
    assert.ok(stored);
    assert.deepEqual(Object.keys(stored.columns).sort(), declared.columns.map((column) => column.name).sort());
    assert.deepEqual(Object.keys(stored.indexes).sort(), declared.indexes.map((index) => index.config.name).sort());
    assert.deepEqual(Object.keys(stored.checkConstraints).sort(), declared.checks.map((check) => check.name).sort());
  }
});

test("the content snapshot matches owner-scoped declarations", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0006_snapshot.json", import.meta.url), "utf8"));
  for (const table of [contentIdeas, contentDrafts, contentDraftRevisions, contentVisualSpecifications, contentMediaAssets]) {
    const declared = getTableConfig(table);
    const stored = snapshot.tables[`public.${declared.name}`];
    assert.ok(stored);
    assert.deepEqual(Object.keys(stored.columns).sort(), declared.columns.map((column) => column.name).sort());
  }
});

test("the discovery snapshot matches lifecycle columns and monitoring table", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0003_snapshot.json", import.meta.url), "utf8"));
  for (const table of [jobDiscoveryRuns, jobSources, jobs]) {
    const declared = getTableConfig(table);
    const stored = snapshot.tables[`public.${declared.name}`];
    assert.ok(stored);
    assert.deepEqual(Object.keys(stored.columns).sort(), declared.columns.map((column) => column.name).sort());
    assert.deepEqual(Object.keys(stored.indexes).sort(), declared.indexes.map((index) => index.config.name).sort());
    assert.deepEqual(Object.keys(stored.checkConstraints).sort(), declared.checks.map((check) => check.name).sort());
  }
});

test("the jobs snapshot matches all declared tables and restrictive foreign keys", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../drizzle/meta/0002_snapshot.json", import.meta.url), "utf8"));
  for (const table of [jobEmployers, jobSources, jobs]) {
    const declared = getTableConfig(table);
    const stored = snapshot.tables[`public.${declared.name}`];
    const laterColumns = new Set(declared.name === "job_sources"
      ? ["last_attempted_sync_at", "last_successful_sync_at", "consecutive_failures"]
      : declared.name === "jobs"
        ? ["last_seen_at", "last_checked_at", "missing_observation_count", "missing_since", "closed_at", "closure_reason"]
        : []);
    const laterIndexes = new Set(["jobs_status_checked_idx"]);
    const laterChecks = new Set([
      "job_sources_failures_nonnegative", "jobs_checked_after_seen", "jobs_missing_state",
      "jobs_missing_count_nonnegative", "jobs_closure_state",
    ]);
    assert.ok(stored, `Missing jobs migration table: ${declared.name}`);
    assert.deepEqual(Object.keys(stored.columns).sort(), declared.columns.map((column) => column.name).filter((name) => !laterColumns.has(name)).sort());
    assert.deepEqual(Object.keys(stored.uniqueConstraints).sort(), declared.uniqueConstraints.map((constraint) => constraint.getName()).sort());
    assert.deepEqual(Object.keys(stored.indexes).sort(), declared.indexes.map((index) => index.config.name).filter((name) => !laterIndexes.has(name)).sort());
    assert.deepEqual(Object.keys(stored.checkConstraints).sort(), declared.checks.map((check) => check.name).filter((name) => !laterChecks.has(name)).sort());
    for (const foreignKey of declared.foreignKeys) {
      assert.equal(stored.foreignKeys[foreignKey.getName()].onDelete, "restrict");
    }
  }
});
