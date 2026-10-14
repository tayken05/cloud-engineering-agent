import { createHash } from "node:crypto";

import { collectionRunsMigrationConfig } from "./collection-runs-migration.config.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";

export class CollectionRunsMigrationGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "CollectionRunsMigrationGuardError";
  }
}

function stop(message) {
  throw new CollectionRunsMigrationGuardError(message);
}

export function validateCollectionRunsMigration(sql, journal) {
  const checksum = createHash("sha256").update(sql).digest("hex");
  if (checksum !== collectionRunsMigrationConfig.migrationSha256) {
    stop("The collection-run migration checksum differs from the reviewed artifact.");
  }
  if (journal?.dialect !== "postgresql" || journal.entries?.length < 2) {
    stop("The Drizzle journal must contain the two reviewed migration entries.");
  }
  const [initial, collectionRuns] = journal.entries;
  if (
    initial?.idx !== 0 ||
    initial?.tag !== productionMigrationConfig.migrationTag ||
    initial?.when !== productionMigrationConfig.migrationTimestamp ||
    collectionRuns?.idx !== 1 ||
    collectionRuns?.tag !== collectionRunsMigrationConfig.migrationTag ||
    collectionRuns?.when !== collectionRunsMigrationConfig.migrationTimestamp
  ) {
    stop("The Drizzle journal identity differs from the reviewed migration sequence.");
  }
  if (/neon_auth/i.test(sql)) {
    stop("The application migration must not reference the managed authentication schema.");
  }
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  if (statements.length !== 6) {
    stop("The collection-run migration statement count is unexpected.");
  }
  for (const statement of statements) {
    if (!/^(CREATE TYPE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX)/.test(statement)) {
      stop("The collection-run migration contains non-additive SQL.");
    }
  }
  return Object.freeze({ checksum, statementCount: statements.length });
}

export function parseCollectionRunsMigrationCommand(arguments_) {
  if (arguments_.length !== 2) {
    stop("Choose --development|--production and --preflight|--execute.");
  }
  const [environment, mode] = arguments_;
  if (!new Set(["--development", "--production"]).has(environment)) {
    stop("Choose --development or --production.");
  }
  if (!new Set(["--preflight", "--execute"]).has(mode)) {
    stop("Choose --preflight or --execute.");
  }
  return Object.freeze({
    environment: environment.slice(2),
    mode: mode.slice(2),
  });
}
