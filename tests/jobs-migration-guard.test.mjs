import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  JobsMigrationGuardError,
  parseJobsMigrationCommand,
  validateJobsMigration,
} from "../scripts/jobs-migration-guard.mjs";
import { jobsMigrationConfig } from "../scripts/jobs-migration.config.mjs";

test("the reviewed jobs migration and journal pass the additive guard", async () => {
  const sql = await readFile(new URL("../drizzle/0002_jobs_opportunities.sql", import.meta.url), "utf8");
  const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  assert.deepEqual(validateJobsMigration(sql, journal), {
    checksum: jobsMigrationConfig.migrationSha256,
    statementCount: 20,
  });
});

test("the jobs migration guard rejects altered SQL and authentication references", async () => {
  const sql = await readFile(new URL("../drizzle/0002_jobs_opportunities.sql", import.meta.url), "utf8");
  const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  assert.throws(() => validateJobsMigration(`${sql}\n-- changed`, journal), JobsMigrationGuardError);
  const unsafe = sql.replace("job_employers", "neon_auth.job_employers");
  assert.throws(() => validateJobsMigration(unsafe, journal), JobsMigrationGuardError);
});

test("jobs migration commands require an explicit environment and mode", () => {
  assert.deepEqual(parseJobsMigrationCommand(["--development", "--preflight"]), { environment: "development", mode: "preflight" });
  assert.deepEqual(parseJobsMigrationCommand(["--production", "--execute"]), { environment: "production", mode: "execute" });
  for (const args of [[], ["--production"], ["--other", "--execute"], ["--production", "--push"]]) {
    assert.throws(() => parseJobsMigrationCommand(args), JobsMigrationGuardError);
  }
});
