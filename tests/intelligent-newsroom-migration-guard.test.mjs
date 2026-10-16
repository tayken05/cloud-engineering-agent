import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateIntelligentNewsroomMigration } from "../scripts/intelligent-newsroom-migration-guard.mjs";

test("intelligent newsroom migration only adds reviewed editorial statuses", async () => {
  const [sql, journal] = await Promise.all([readFile("drizzle/0007_intelligent_newsroom.sql", "utf8"), readFile("drizzle/meta/_journal.json", "utf8").then(JSON.parse)]);
  const result = validateIntelligentNewsroomMigration(sql, journal);
  assert.equal(result.statementCount, 3);
  assert.match(sql, /ADD VALUE 'needs_review'/);
  assert.match(sql, /ADD VALUE 'approved'/);
  assert.match(sql, /ADD VALUE 'rejected'/);
  assert.doesNotMatch(sql, /neon_auth/i);
  assert.doesNotMatch(sql, /^\s*(?:DROP|TRUNCATE|DELETE|INSERT|UPDATE|CREATE TABLE)\b/im);
});

test("intelligent newsroom migration guard rejects altered artifacts", async () => {
  const [sql, journal] = await Promise.all([readFile("drizzle/0007_intelligent_newsroom.sql", "utf8"), readFile("drizzle/meta/_journal.json", "utf8").then(JSON.parse)]);
  assert.throws(() => validateIntelligentNewsroomMigration(`${sql}\nSELECT 1;`, journal), /checksum/);
  assert.throws(() => validateIntelligentNewsroomMigration(sql, { ...journal, entries: journal.entries.slice(0, -1) }), /journal/);
});
