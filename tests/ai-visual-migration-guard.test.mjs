import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateAiVisualMigration } from "../scripts/ai-visual-migration-guard.mjs";

test("AI visual migration is forward-only and preserves managed auth", async () => {
  const [sql, journal] = await Promise.all([readFile("drizzle/0006_ai_visual_content.sql", "utf8"), readFile("drizzle/meta/_journal.json", "utf8").then(JSON.parse)]);
  const result = validateAiVisualMigration(sql, journal);
  assert.equal(result.statementCount, 10);
  assert.match(sql, /CREATE TABLE "content_media_assets"/);
  assert.match(sql, /ALTER TYPE "public"\."ai_generation_kind" ADD VALUE 'image'/);
  assert.doesNotMatch(sql, /neon_auth/i);
  assert.doesNotMatch(sql, /^\s*(?:DROP|TRUNCATE|DELETE|INSERT|UPDATE)\b/im);
});

test("AI visual migration guard rejects altered artifacts", async () => {
  const [sql, journal] = await Promise.all([readFile("drizzle/0006_ai_visual_content.sql", "utf8"), readFile("drizzle/meta/_journal.json", "utf8").then(JSON.parse)]);
  assert.throws(() => validateAiVisualMigration(`${sql}\nSELECT 1;`, journal), /checksum/);
  assert.throws(() => validateAiVisualMigration(sql, { ...journal, entries: journal.entries.slice(0, -1) }), /journal/);
});
