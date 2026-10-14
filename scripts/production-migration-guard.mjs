import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";

import { productionMigrationConfig } from "./production-migration.config.mjs";

export class ProductionMigrationGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProductionMigrationGuardError";
  }
}

function stop(message) {
  throw new ProductionMigrationGuardError(message);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateProductionDatabaseUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    stop(`${productionMigrationConfig.credentialVariable} is required.`);
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    stop("The production migration credential is not a valid URL.");
  }

  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    stop("The production migration credential must use PostgreSQL.");
  }
  if (!parsed.username || !parsed.password) {
    stop("The production migration credential must include database credentials.");
  }
  if (parsed.port && parsed.port !== "5432") {
    stop("The production migration credential must use the PostgreSQL port.");
  }
  if (!parsed.hostname.endsWith(".neon.tech")) {
    stop("The production migration credential must use a Neon hostname.");
  }

  const endpoint = parsed.hostname.split(".")[0]?.toLowerCase();
  if (!endpoint) {
    stop("The production migration hostname has no endpoint identifier.");
  }
  if (endpoint.endsWith("-pooler")) {
    stop("A pooled connection is forbidden for the production migration.");
  }
  if (endpoint === productionMigrationConfig.forbiddenDevelopmentEndpoint) {
    stop("The development endpoint is forbidden for the production migration.");
  }
  if (endpoint !== productionMigrationConfig.endpoint) {
    stop(
      `The endpoint must exactly match the verified production endpoint ${productionMigrationConfig.endpoint}.`,
    );
  }

  let database;
  try {
    database = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    stop("The production migration database name is invalid.");
  }
  if (database !== productionMigrationConfig.database || database.includes("/")) {
    stop(`The production migration database must be ${productionMigrationConfig.database}.`);
  }

  const sslModes = parsed.searchParams.getAll("sslmode");
  if (sslModes.length !== 1 || !new Set(["require", "verify-full"]).has(sslModes[0])) {
    stop("The production migration credential must require TLS.");
  }
  if (parsed.searchParams.has("options")) {
    stop("Connection options that could change the schema search path are forbidden.");
  }
  if (parsed.hash) {
    stop("The production migration credential must not contain a URL fragment.");
  }

  return Object.freeze({
    connectionString: value.trim(),
    database,
    endpoint,
  });
}

export function parseProductionCredential(content) {
  let values;
  try {
    values = parseEnv(content);
  } catch {
    stop("The production migration credential file could not be parsed.");
  }

  const keys = Object.keys(values);
  if (
    keys.length !== 1 ||
    keys[0] !== productionMigrationConfig.credentialVariable
  ) {
    stop(
      `The credential file must contain only ${productionMigrationConfig.credentialVariable}.`,
    );
  }

  return validateProductionDatabaseUrl(
    values[productionMigrationConfig.credentialVariable],
  );
}

export async function loadProductionCredential(projectRoot) {
  const filePath = path.join(
    projectRoot,
    productionMigrationConfig.credentialFile,
  );

  let metadata;
  try {
    metadata = await lstat(filePath);
  } catch {
    stop(`Missing ignored credential file ${productionMigrationConfig.credentialFile}.`);
  }

  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    stop("The production migration credential must be a regular, non-symlink file.");
  }
  if ((metadata.mode & 0o077) !== 0) {
    stop("The production migration credential file permissions must be 0600.");
  }
  if (metadata.size > 8_192) {
    stop("The production migration credential file is unexpectedly large.");
  }

  let content;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    stop("The production migration credential file could not be read.");
  }

  return {
    ...parseProductionCredential(content),
    filePath,
  };
}

export function assertMigrationArtifact(sql, journal) {
  if (sha256(sql) !== productionMigrationConfig.migrationSha256) {
    stop("The checked-in production migration checksum does not match the tested artifact.");
  }
  if (!journal || journal.dialect !== "postgresql" || !Array.isArray(journal.entries) || journal.entries.length < 1) {
    stop("The Drizzle migration journal does not contain the reviewed initial history entry.");
  }

  const entry = journal.entries[0];
  if (
    entry.idx !== 0 ||
    entry.tag !== productionMigrationConfig.migrationTag ||
    entry.when !== productionMigrationConfig.migrationTimestamp
  ) {
    stop("The Drizzle migration journal entry does not match the tested migration.");
  }
  if (/neon_auth/i.test(sql)) {
    stop("The application migration must not reference the managed neon_auth schema.");
  }

  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    if (
      !/^(CREATE TYPE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX|ALTER TABLE .* ADD CONSTRAINT)/.test(
        statement,
      )
    ) {
      stop("The migration contains a statement outside the reviewed additive DDL set.");
    }
  }

  return Object.freeze({
    sha256: productionMigrationConfig.migrationSha256,
    statementCount: statements.length,
  });
}

export function parseCommandMode(arguments_) {
  if (arguments_.length === 1 && arguments_[0] === "--preflight") {
    return "preflight";
  }
  if (arguments_.length === 1 && arguments_[0] === "--execute") {
    return "execute";
  }
  stop("Choose exactly one mode: --preflight or --execute.");
}
