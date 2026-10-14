import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";

export const sourceCatalogConfig = Object.freeze({
  database: "neondb",
  developmentCredentialFile: ".env.local",
  developmentEndpoint: "ep-sweet-bread-b72xtg4u",
  productionEndpoint: "ep-spring-grass-b7iye83x",
  productionConfirmation:
    "REGISTER APPROVED SOURCES IN NEON MAIN ep-spring-grass-b7iye83x",
});

export class SourceCatalogGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "SourceCatalogGuardError";
  }
}

function stop(message) {
  throw new SourceCatalogGuardError(message);
}

export function validateDevelopmentDatabaseUrls(values) {
  const allowedKeys = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"];
  const keys = Object.keys(values).sort();
  if (JSON.stringify(keys) !== JSON.stringify(allowedKeys.sort())) {
    stop("The development credential file must contain only the pooled and direct database variables.");
  }

  const pooled = validateDatabaseUrl(values.DATABASE_URL, true);
  const direct = validateDatabaseUrl(values.DATABASE_URL_UNPOOLED, false);
  if (pooled.database !== direct.database || pooled.endpoint !== direct.endpoint) {
    stop("The development database URLs do not identify the same endpoint and database.");
  }

  return Object.freeze({
    connectionString: direct.connectionString,
    database: direct.database,
    endpoint: direct.endpoint,
    pooledConnectionString: pooled.connectionString,
  });
}

function validateDatabaseUrl(value, pooled) {
  if (typeof value !== "string" || value.trim().length === 0) {
    stop("A required development database credential is missing.");
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    stop("A development database credential is not a valid URL.");
  }

  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    stop("Development database credentials must use PostgreSQL.");
  }
  if (!parsed.username || !parsed.password || !parsed.hostname.endsWith(".neon.tech")) {
    stop("A development database credential is incomplete or is not a Neon URL.");
  }
  if (parsed.port && parsed.port !== "5432") {
    stop("Development database credentials must use the PostgreSQL port.");
  }

  const hostLabel = parsed.hostname.split(".")[0]?.toLowerCase();
  const expectedHostLabel = `${sourceCatalogConfig.developmentEndpoint}${pooled ? "-pooler" : ""}`;
  if (hostLabel !== expectedHostLabel) {
    stop("A development database credential does not match the approved endpoint and connection mode.");
  }

  let database;
  try {
    database = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    stop("The development database name is invalid.");
  }
  if (database !== sourceCatalogConfig.database || database.includes("/")) {
    stop(`The development database must be ${sourceCatalogConfig.database}.`);
  }
  const sslModes = parsed.searchParams.getAll("sslmode");
  if (sslModes.length !== 1 || !new Set(["require", "verify-full"]).has(sslModes[0])) {
    stop("Development database credentials must require TLS.");
  }
  if (parsed.searchParams.has("options") || parsed.hash) {
    stop("Unsafe development database URL options are forbidden.");
  }

  return Object.freeze({
    connectionString: value.trim(),
    database,
    endpoint: sourceCatalogConfig.developmentEndpoint,
  });
}

export async function loadDevelopmentCredential(projectRoot) {
  const filePath = path.join(projectRoot, sourceCatalogConfig.developmentCredentialFile);
  let metadata;
  try {
    metadata = await lstat(filePath);
  } catch {
    stop(`Missing ignored credential file ${sourceCatalogConfig.developmentCredentialFile}.`);
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    stop("The development credential must be a regular, non-symlink file.");
  }
  if ((metadata.mode & 0o077) !== 0) {
    stop("The development credential file permissions must be 0600.");
  }
  if (metadata.size > 8_192) {
    stop("The development credential file is unexpectedly large.");
  }

  let values;
  try {
    values = parseEnv(await readFile(filePath, "utf8"));
  } catch {
    stop("The development credential file could not be parsed.");
  }
  return { ...validateDevelopmentDatabaseUrls(values), filePath };
}

export function parseSourceCatalogCommand(arguments_) {
  if (arguments_.length !== 2) {
    stop("Choose an environment and mode: --development|--production plus --preflight|--execute.");
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

export function validateTrustedSourceCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length < 10 || catalog.length > 12) {
    stop("The approved source catalog must contain between 10 and 12 entries.");
  }
  const keys = new Set();
  const urls = new Set();
  for (const source of catalog) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.key)) {
      stop("The approved source catalog contains an invalid key.");
    }
    let url;
    try {
      url = new URL(source.canonicalUrl);
    } catch {
      stop("The approved source catalog contains an invalid URL.");
    }
    if (url.protocol !== "https:" || url.username || url.password) {
      stop("Approved source URLs must be credential-free HTTPS URLs.");
    }
    if (keys.has(source.key) || urls.has(source.canonicalUrl)) {
      stop("The approved source catalog contains a duplicate key or URL.");
    }
    if (!source.name.trim() || !source.description?.trim()) {
      stop("Every approved source requires a name and description.");
    }
    keys.add(source.key);
    urls.add(source.canonicalUrl);
  }
  return catalog;
}

function identityMatches(existing, expected) {
  return existing.key === expected.key &&
    existing.name === expected.name &&
    existing.canonicalUrl === expected.canonicalUrl &&
    existing.kind === expected.kind &&
    existing.primaryTopic === expected.primaryTopic &&
    existing.description === expected.description;
}

export function planSourceCatalog(existingRows, catalog) {
  validateTrustedSourceCatalog(catalog);
  const byKey = new Map(existingRows.map((row) => [row.key, row]));
  const byUrl = new Map(existingRows.map((row) => [row.canonicalUrl, row]));
  const missing = [];

  for (const expected of catalog) {
    const keyMatch = byKey.get(expected.key);
    const urlMatch = byUrl.get(expected.canonicalUrl);
    if (keyMatch && urlMatch && keyMatch.id !== urlMatch.id) {
      stop("An approved source key and URL resolve to different existing records.");
    }
    const existing = keyMatch ?? urlMatch;
    if (!existing) {
      missing.push(expected);
      continue;
    }
    if (!identityMatches(existing, expected)) {
      stop("An existing source conflicts with the approved source catalog.");
    }
  }

  return Object.freeze({ missing });
}
