import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateAiContentMigration } from "../scripts/ai-content-migration-guard.mjs";

test("AI-content migration is additive and preserves managed auth", async () => {
  const [sql, journal] = await Promise.all([
    readFile("drizzle/0005_ai_content_generation.sql", "utf8"),
    readFile("drizzle/meta/_journal.json", "utf8").then(JSON.parse),
  ]);
  const result = validateAiContentMigration(sql, journal);
  assert.equal(result.statementCount, 18);
  assert.doesNotMatch(sql, /neon_auth/i);
  for (const table of ["ai_generation_runs", "ai_content_suggestions", "ai_generation_evidence"]) assert.match(sql, new RegExp(`CREATE TABLE "${table}"`));
  assert.doesNotMatch(sql, /^\s*(?:DROP|TRUNCATE|DELETE|INSERT|UPDATE)\b/im);
});

test("AI-content migration guard rejects modified SQL and journal history", async () => {
  const [sql, journal] = await Promise.all([
    readFile("drizzle/0005_ai_content_generation.sql", "utf8"),
    readFile("drizzle/meta/_journal.json", "utf8").then(JSON.parse),
  ]);
  assert.throws(() => validateAiContentMigration(`${sql}\nSELECT 1;`, journal), /checksum/);
  assert.throws(() => validateAiContentMigration(sql, { ...journal, entries: journal.entries.slice(0, -1) }), /journal/);
});
