import { createHash } from "node:crypto";

import { aiContentMigrationConfig as config } from "./ai-content-migration.config.mjs";
import { approvedMigrationHistory } from "./migration-history-guard.mjs";

export class AiContentMigrationGuardError extends Error {
  constructor(message) { super(message); this.name = "AiContentMigrationGuardError"; }
}

function stop(message) { throw new AiContentMigrationGuardError(message); }

export function validateAiContentMigration(sql, journal) {
  const checksum = createHash("sha256").update(sql).digest("hex");
  if (checksum !== config.migrationSha256) stop("The AI-content migration checksum differs from the reviewed artifact.");
  if (journal?.dialect !== "postgresql" || journal.entries?.length !== approvedMigrationHistory.length || !journal.entries.every((entry, index) => entry.idx === index && entry.when === approvedMigrationHistory[index]?.timestamp && entry.tag === approvedMigrationHistory[index]?.tag)) {
    stop("The Drizzle journal differs from the reviewed migration history.");
  }
  if (/neon_auth/i.test(sql)) stop("The migration must not reference managed authentication.");
  const statements = sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
  if (statements.length !== 18 || statements.some((statement) => !/^(CREATE TYPE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX|ALTER TABLE .* ADD CONSTRAINT)/.test(statement))) {
    stop("The migration contains SQL outside the reviewed additive DDL set.");
  }
  return { checksum, statementCount: statements.length };
}

export function parseAiContentMigrationCommand(args) {
  if (args.length !== 2 || !["--development", "--production"].includes(args[0]) || !["--preflight", "--execute"].includes(args[1])) {
    stop("Choose --development|--production and --preflight|--execute.");
  }
  return { environment: args[0].slice(2), mode: args[1].slice(2) };
}
