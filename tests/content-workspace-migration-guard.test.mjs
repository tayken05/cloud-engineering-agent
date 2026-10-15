import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateContentWorkspaceMigration } from "../scripts/content-workspace-migration-guard.mjs";

test("content workspace migration is additive and preserves managed auth", async () => {
  const [sql, journal] = await Promise.all([readFile("drizzle/0004_content_workspace.sql", "utf8"), readFile("drizzle/meta/_journal.json", "utf8").then(JSON.parse)]);
  const result = validateContentWorkspaceMigration(sql, journal);
  assert.equal(result.statementCount, 31);
  assert.doesNotMatch(sql, /neon_auth/i);
  for (const table of ["content_ideas", "content_drafts", "content_draft_revisions", "content_visual_specifications"]) assert.match(sql, new RegExp(`CREATE TABLE "${table}"`));
});

test("migration guard rejects modified SQL", async () => {
  const [sql, journal] = await Promise.all([readFile("drizzle/0004_content_workspace.sql", "utf8"), readFile("drizzle/meta/_journal.json", "utf8").then(JSON.parse)]);
  assert.throws(() => validateContentWorkspaceMigration(`${sql}\nSELECT 1;`, journal), /checksum/);
});
