import { createHash } from "node:crypto";

import { collectionRunsMigrationConfig } from "./collection-runs-migration.config.mjs";
import { jobDiscoveryMigrationConfig } from "./job-discovery-migration.config.mjs";
import { jobsMigrationConfig } from "./jobs-migration.config.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";

export class JobDiscoveryMigrationGuardError extends Error {
  constructor(message) { super(message); this.name = "JobDiscoveryMigrationGuardError"; }
}
function stop(message) { throw new JobDiscoveryMigrationGuardError(message); }

export function validateJobDiscoveryMigration(sql, journal) {
  const checksum = createHash("sha256").update(sql).digest("hex");
  if (checksum !== jobDiscoveryMigrationConfig.migrationSha256) stop("The job-discovery migration checksum differs from the reviewed artifact.");
  const expected = [
    [0, productionMigrationConfig.migrationTag, productionMigrationConfig.migrationTimestamp],
    [1, collectionRunsMigrationConfig.migrationTag, collectionRunsMigrationConfig.migrationTimestamp],
    [2, jobsMigrationConfig.migrationTag, jobsMigrationConfig.migrationTimestamp],
    [3, jobDiscoveryMigrationConfig.migrationTag, jobDiscoveryMigrationConfig.migrationTimestamp],
  ];
  if (journal?.dialect !== "postgresql" || journal.entries?.length !== expected.length ||
    !journal.entries.every((entry, index) => entry.idx === expected[index][0] && entry.tag === expected[index][1] && entry.when === expected[index][2])) {
    stop("The Drizzle journal differs from the four reviewed migrations.");
  }
  if (/neon_auth/i.test(sql)) stop("The migration must not reference managed authentication.");
  const statements = sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
  if (statements.length !== 20) stop("The migration statement count is unexpected.");
  for (const statement of statements) {
    if (!/^(CREATE TYPE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX|ALTER TABLE .* ADD (COLUMN|CONSTRAINT))/.test(statement)) {
      stop("The migration contains SQL outside the reviewed additive DDL set.");
    }
  }
  return Object.freeze({ checksum, statementCount: statements.length });
}

export function parseJobDiscoveryMigrationCommand(arguments_) {
  if (arguments_.length !== 2) stop("Choose --development|--production and --preflight|--execute.");
  const [environment, mode] = arguments_;
  if (!new Set(["--development", "--production"]).has(environment)) stop("Choose --development or --production.");
  if (!new Set(["--preflight", "--execute"]).has(mode)) stop("Choose --preflight or --execute.");
  return Object.freeze({ environment: environment.slice(2), mode: mode.slice(2) });
}
