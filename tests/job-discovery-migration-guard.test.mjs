import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { jobDiscoveryMigrationConfig } from "../scripts/job-discovery-migration.config.mjs";
import {
  JobDiscoveryMigrationGuardError,
  parseJobDiscoveryMigrationCommand,
  validateJobDiscoveryMigration,
} from "../scripts/job-discovery-migration-guard.mjs";

test("the reviewed job-discovery migration passes the additive guard", async () => {
  const sql = await readFile(new URL("../drizzle/0003_job_discovery.sql", import.meta.url), "utf8");
  const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  assert.deepEqual(validateJobDiscoveryMigration(sql, journal), {
    checksum: jobDiscoveryMigrationConfig.migrationSha256,
    statementCount: 20,
  });
});

test("the job-discovery guard rejects altered and authentication SQL", async () => {
  const sql = await readFile(new URL("../drizzle/0003_job_discovery.sql", import.meta.url), "utf8");
  const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  assert.throws(() => validateJobDiscoveryMigration(`${sql}\n-- changed`, journal), JobDiscoveryMigrationGuardError);
  assert.throws(() => validateJobDiscoveryMigration(sql.replace("job_discovery_runs", "neon_auth.job_discovery_runs"), journal), JobDiscoveryMigrationGuardError);
});

test("job-discovery migration commands require explicit environment and mode", () => {
  assert.deepEqual(parseJobDiscoveryMigrationCommand(["--development", "--preflight"]), { environment: "development", mode: "preflight" });
  assert.deepEqual(parseJobDiscoveryMigrationCommand(["--production", "--execute"]), { environment: "production", mode: "execute" });
  assert.throws(() => parseJobDiscoveryMigrationCommand(["--production"]), JobDiscoveryMigrationGuardError);
});
