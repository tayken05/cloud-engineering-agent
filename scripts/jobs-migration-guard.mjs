import { createHash } from "node:crypto";

import { collectionRunsMigrationConfig } from "./collection-runs-migration.config.mjs";
import { jobsMigrationConfig } from "./jobs-migration.config.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";

export class JobsMigrationGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "JobsMigrationGuardError";
  }
}

function stop(message) {
  throw new JobsMigrationGuardError(message);
}

export function validateJobsMigration(sql, journal) {
  const checksum = createHash("sha256").update(sql).digest("hex");
  if (checksum !== jobsMigrationConfig.migrationSha256) {
    stop("The jobs migration checksum differs from the reviewed artifact.");
  }
  if (journal?.dialect !== "postgresql" || journal.entries?.length !== 3) {
    stop("The Drizzle journal must contain exactly the three reviewed migrations.");
  }
  const expected = [
    [0, productionMigrationConfig.migrationTag, productionMigrationConfig.migrationTimestamp],
    [1, collectionRunsMigrationConfig.migrationTag, collectionRunsMigrationConfig.migrationTimestamp],
    [2, jobsMigrationConfig.migrationTag, jobsMigrationConfig.migrationTimestamp],
  ];
  if (!journal.entries.every((entry, index) => (
    entry.idx === expected[index][0] &&
    entry.tag === expected[index][1] &&
    entry.when === expected[index][2]
  ))) stop("The Drizzle journal identity differs from the reviewed migration sequence.");
  if (/neon_auth/i.test(sql)) stop("The jobs migration must not reference managed authentication.");

  const statements = sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
  if (statements.length !== 20) stop("The jobs migration statement count is unexpected.");
  for (const statement of statements) {
    if (!/^(CREATE TYPE|CREATE TABLE|CREATE INDEX|ALTER TABLE .* ADD CONSTRAINT)/.test(statement)) {
      stop("The jobs migration contains SQL outside the reviewed additive DDL set.");
    }
  }
  for (const table of jobsMigrationConfig.tables) {
    if (!sql.includes(`CREATE TABLE "${table}"`)) stop(`The jobs migration is missing ${table}.`);
  }
  return Object.freeze({ checksum, statementCount: statements.length });
}

export function parseJobsMigrationCommand(arguments_) {
  if (arguments_.length !== 2) stop("Choose --development|--production and --preflight|--execute.");
  const [environment, mode] = arguments_;
  if (!new Set(["--development", "--production"]).has(environment)) stop("Choose --development or --production.");
  if (!new Set(["--preflight", "--execute"]).has(mode)) stop("Choose --preflight or --execute.");
  return Object.freeze({ environment: environment.slice(2), mode: mode.slice(2) });
}
