import { createHash } from "node:crypto";

import { intelligentNewsroomMigrationConfig as config } from "./intelligent-newsroom-migration.config.mjs";
import { approvedMigrationHistory } from "./migration-history-guard.mjs";

export class IntelligentNewsroomMigrationGuardError extends Error {
  constructor(message) { super(message); this.name = "IntelligentNewsroomMigrationGuardError"; }
}

function stop(message) { throw new IntelligentNewsroomMigrationGuardError(message); }

export function validateIntelligentNewsroomMigration(sql, journal) {
  const checksum = createHash("sha256").update(sql).digest("hex");
  if (checksum !== config.migrationSha256) stop("The intelligent-newsroom migration checksum differs from the reviewed artifact.");
  if (journal?.dialect !== "postgresql" || journal.entries?.length !== approvedMigrationHistory.length
    || !journal.entries.every((entry, index) => entry.idx === index
      && entry.when === approvedMigrationHistory[index]?.timestamp
      && entry.tag === approvedMigrationHistory[index]?.tag)) {
    stop("The Drizzle journal differs from the reviewed migration history.");
  }
  if (/neon_auth/i.test(sql)) stop("The migration must not reference managed authentication.");
  const statements = sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
  if (statements.length !== 3 || statements.some((statement) => !/^ALTER TYPE "public"\."content_draft_status" ADD VALUE '(?:needs_review|approved|rejected)';?$/.test(statement))) {
    stop("The migration contains SQL outside the three reviewed editorial-status additions.");
  }
  if (new Set(statements).size !== 3) stop("The editorial-status migration contains duplicate statements.");
  return { checksum, statementCount: statements.length };
}

export function parseIntelligentNewsroomMigrationCommand(args) {
  if (args.length !== 2 || !["--development", "--production"].includes(args[0]) || !["--preflight", "--execute"].includes(args[1])) {
    stop("Choose --development|--production and --preflight|--execute.");
  }
  return { environment: args[0].slice(2), mode: args[1].slice(2) };
}
