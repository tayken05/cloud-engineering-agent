import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { getDatabaseUrl } from "../src/server/db/environment.ts";
import { sources, sourceItems, stories, storySourceItems } from "../src/server/db/schema.ts";
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

test("initial migration contains only the declared additive schema and journal entry", async () => {
  const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  assert.equal(journal.entries.length, 1);
  const migration = await readFile(new URL(`../drizzle/${journal.entries[0].tag}.sql`, import.meta.url), "utf8");
  const statements = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
  assert.ok(statements.length > 0);
  for (const statement of statements) {
    assert.match(statement, /^(CREATE TYPE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX|ALTER TABLE .* ADD CONSTRAINT)/);
    assert.doesNotMatch(statement, /^(DROP|TRUNCATE|DELETE|INSERT|UPDATE)\b/);
  }
  assert.equal((migration.match(/CREATE TABLE /g) ?? []).length, 4);
  assert.equal((migration.match(/FOREIGN KEY /g) ?? []).length, 3);
});

test("the entire existing SQL migration matches fresh offline generation from the schema", async () => {
  // Generate in memory only: no files, credentials, connections, or schema execution.
  const generated = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
  const migration = await readFile(new URL("../drizzle/0000_initial_intelligence.sql", import.meta.url), "utf8");
  const existing = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
  assert.deepEqual(existing, generated.map((statement) => statement.trim()));
});
