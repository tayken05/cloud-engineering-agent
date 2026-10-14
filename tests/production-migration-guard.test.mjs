import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { productionMigrationConfig as config } from "../scripts/production-migration.config.mjs";
import {
  assertMigrationArtifact,
  loadProductionCredential,
  parseCommandMode,
  parseProductionCredential,
  validateProductionDatabaseUrl,
} from "../scripts/production-migration-guard.mjs";

const directUrl = [
  "postgresql:",
  "//",
  "test-role:test-value@",
  config.endpoint,
  ".unit-test.aws.neon.tech/",
  config.database,
  "?sslmode=require&channel_binding=require",
].join("");

test("the dedicated direct production credential is accepted", () => {
  const result = validateProductionDatabaseUrl(directUrl);
  assert.equal(result.endpoint, config.endpoint);
  assert.equal(result.database, config.database);
});

test("missing, pooled, development, recovery, and unknown endpoints are rejected", () => {
  const invalid = [
    "",
    directUrl.replace(config.endpoint, `${config.endpoint}-pooler`),
    directUrl.replace(config.endpoint, config.forbiddenDevelopmentEndpoint),
    directUrl.replace(config.endpoint, "ep-recovery-checkpoint"),
    directUrl.replace(config.endpoint, "ep-another-neon-endpoint"),
  ];
  for (const value of invalid) {
    assert.throws(() => validateProductionDatabaseUrl(value));
  }
});

test("wrong databases, non-Neon hosts, unsafe options, and missing TLS are rejected", () => {
  const invalid = [
    directUrl.replace("/neondb?", "/other?"),
    directUrl.replace(".neon.tech", ".example.invalid"),
    `${directUrl}&options=-c%20search_path%3Dneon_auth`,
    directUrl.replace("sslmode=require&", ""),
  ];
  for (const value of invalid) {
    assert.throws(() => validateProductionDatabaseUrl(value));
  }
});

test("the credential file accepts only the dedicated production variable", () => {
  const parsed = parseProductionCredential(
    `${config.credentialVariable}=${directUrl}\n`,
  );
  assert.equal(parsed.endpoint, config.endpoint);

  assert.throws(() =>
    parseProductionCredential(`DATABASE_URL_UNPOOLED=${directUrl}\n`),
  );
  assert.throws(() =>
    parseProductionCredential(
      `${config.credentialVariable}=${directUrl}\nDATABASE_URL_UNPOOLED=${directUrl}\n`,
    ),
  );
});

test("the exact tested SQL and journal are required", async () => {
  const [sql, journalText] = await Promise.all([
    readFile(new URL("../drizzle/0000_initial_intelligence.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
  ]);
  const result = assertMigrationArtifact(sql, JSON.parse(journalText));
  assert.equal(result.sha256, config.migrationSha256);
  assert.throws(() => assertMigrationArtifact(`${sql}\n`, JSON.parse(journalText)));
  assert.throws(() =>
    assertMigrationArtifact(sql, {
      ...JSON.parse(journalText),
      entries: [],
    }),
  );
});

test("the production catalog expectations match the checked-in snapshot", async () => {
  const snapshot = JSON.parse(
    await readFile(
      new URL("../drizzle/meta/0000_snapshot.json", import.meta.url),
      "utf8",
    ),
  );
  const tables = Object.values(snapshot.tables);

  assert.deepEqual(
    [...config.applicationTables].sort(),
    tables.map((table) => table.name).sort(),
  );
  assert.deepEqual(
    [...config.enumTypes].sort(),
    Object.values(snapshot.enums).map((entry) => entry.name).sort(),
  );
  assert.deepEqual(
    [...config.explicitIndexes].sort(),
    tables.flatMap((table) => Object.keys(table.indexes)).sort(),
  );
  assert.deepEqual(
    [...config.foreignKeys].sort(),
    tables.flatMap((table) => Object.keys(table.foreignKeys)).sort(),
  );
  assert.deepEqual(
    [...config.uniqueConstraints].sort(),
    tables.flatMap((table) => Object.keys(table.uniqueConstraints)).sort(),
  );
  assert.deepEqual(
    [...config.checkConstraints].sort(),
    tables.flatMap((table) => Object.keys(table.checkConstraints)).sort(),
  );
});

test("execution mode must always be explicit", () => {
  assert.equal(parseCommandMode(["--preflight"]), "preflight");
  assert.equal(parseCommandMode(["--execute"]), "execute");
  assert.throws(() => parseCommandMode([]));
  assert.throws(() => parseCommandMode(["--execute", "--preflight"]));
});

test("the credential loader requires a private dedicated file", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "production-migration-"));
  const credentialFile = path.join(directory, config.credentialFile);
  try {
    await writeFile(
      credentialFile,
      `${config.credentialVariable}=${directUrl}\n`,
      { mode: 0o600 },
    );
    const credential = await loadProductionCredential(directory);
    assert.equal(credential.endpoint, config.endpoint);

    await chmod(credentialFile, 0o644);
    await assert.rejects(() => loadProductionCredential(directory), /0600/);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("the runner cannot start without an explicit mode", () => {
  const result = spawnSync(
    process.execPath,
    [new URL("../scripts/production-migration.mjs", import.meta.url).pathname],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Choose exactly one mode/);
  assert.doesNotMatch(result.stderr, /postgres(?:ql)?:\/\//);
});
