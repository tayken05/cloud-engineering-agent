import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { productionMigrationConfig as config } from "./production-migration.config.mjs";
import {
  assertMigrationArtifact,
  loadProductionCredential,
  parseCommandMode,
  ProductionMigrationGuardError,
} from "./production-migration-guard.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function stop(message) {
  throw new ProductionMigrationGuardError(message);
}

function sorted(values) {
  return [...values].sort();
}

function assertSameValues(actual, expected, label) {
  if (JSON.stringify(sorted(actual)) !== JSON.stringify(sorted(expected))) {
    stop(`The ${label} catalog does not match the reviewed migration.`);
  }
}

function fingerprint(rows) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function assertCredentialFileIsIgnored() {
  const result = spawnSync(
    "git",
    ["check-ignore", "--quiet", "--", config.credentialFile],
    { cwd: projectRoot, stdio: "ignore" },
  );
  if (result.status !== 0) {
    stop(`${config.credentialFile} must be excluded by Git before use.`);
  }
}

async function readAndVerifyMigration() {
  const [sql, journalText] = await Promise.all([
    readFile(path.join(projectRoot, config.migrationFile), "utf8"),
    readFile(path.join(projectRoot, config.migrationJournal), "utf8"),
  ]);

  let journal;
  try {
    journal = JSON.parse(journalText);
  } catch {
    stop("The Drizzle migration journal is not valid JSON.");
  }
  return assertMigrationArtifact(sql, journal);
}

async function getAuthCatalog(client) {
  const tables = await client.query(`
    SELECT c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'neon_auth' AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  `);
  const columns = await client.query(`
    SELECT
      c.relname AS table_name,
      a.attnum AS column_position,
      a.attname AS column_name,
      format_type(a.atttypid, a.atttypmod) AS data_type,
      a.attnotnull AS not_null,
      pg_get_expr(d.adbin, d.adrelid) AS column_default
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_catalog.pg_attrdef d
      ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'neon_auth'
      AND c.relkind IN ('r', 'p')
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum
  `);
  const constraints = await client.query(`
    SELECT
      c.relname AS table_name,
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'neon_auth'
    ORDER BY c.relname, con.conname
  `);
  const indexes = await client.query(`
    SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'neon_auth'
    ORDER BY tablename, indexname
  `);

  return {
    fingerprint: fingerprint({
      columns: columns.rows,
      constraints: constraints.rows,
      indexes: indexes.rows,
      tables: tables.rows,
    }),
    tableCount: tables.rowCount,
  };
}

async function inspectBeforeMigration(client) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    const identity = await client.query(`
      SELECT
        current_database() AS database_name,
        current_schema() AS current_schema,
        current_schemas(false) AS active_schemas
    `);
    const current = identity.rows[0];
    if (current?.database_name !== config.database) {
      stop(`The connected database must be ${config.database}.`);
    }
    if (
      current?.current_schema !== "public" ||
      current.active_schemas?.includes("neon_auth")
    ) {
      stop("The connection schema search path is not safe for the application migration.");
    }

    const tables = await client.query(`
      SELECT c.relname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname
    `);
    const enums = await client.query(`
      SELECT t.typname
      FROM pg_catalog.pg_type t
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype = 'e'
      ORDER BY t.typname
    `);
    const plannedRelations = await client.query(`
      SELECT c.relname, c.relkind
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname
    `, [config.applicationTables]);
    const plannedTypes = await client.query(`
      SELECT t.typname, t.typtype
      FROM pg_catalog.pg_type t
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = ANY($1::text[])
      ORDER BY t.typname
    `, [config.enumTypes]);
    const drizzleObjects = await client.query(`
      SELECT c.relname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'drizzle'
      ORDER BY c.relname
    `);
    const authCatalog = await getAuthCatalog(client);

    if (tables.rowCount !== 0) {
      stop("Production public schema contains unexpected tables; migration aborted.");
    }
    if (enums.rowCount !== 0) {
      stop("Production public schema contains unexpected enum types; migration aborted.");
    }
    if (plannedRelations.rowCount !== 0 || plannedTypes.rowCount !== 0) {
      stop("Production contains objects whose names conflict with the reviewed migration.");
    }
    if (drizzleObjects.rowCount !== 0) {
      stop("Production contains unexpected Drizzle migration objects; migration aborted.");
    }
    if (authCatalog.tableCount !== config.expectedAuthTableCount) {
      stop("The managed neon_auth catalog differs from the verified production baseline.");
    }

    await client.query("COMMIT");
    return { authCatalog };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function verifyAfterMigration(client, before) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    const tables = await client.query(`
      SELECT c.relname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname
    `);
    const enums = await client.query(`
      SELECT t.typname
      FROM pg_catalog.pg_type t
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype = 'e'
      ORDER BY t.typname
    `);
    const indexes = await client.query(`
      SELECT indexname
      FROM pg_catalog.pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
      ORDER BY indexname
    `, [config.explicitIndexes]);
    const constraints = await client.query(`
      SELECT
        con.conname,
        con.contype,
        con.confdeltype,
        con.confupdtype,
        con.convalidated,
        con.conindid <> 0 AS has_backing_index
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = ANY($1::text[])
      ORDER BY con.conname
    `, [config.applicationTables]);
    const history = await client.query(`
      SELECT hash, created_at
      FROM drizzle.__drizzle_migrations
      ORDER BY id
    `);
    const authCatalog = await getAuthCatalog(client);
    const residue = await client.query(`
      SELECT
        (SELECT count(*) FROM public.sources) AS sources,
        (SELECT count(*) FROM public.source_items) AS source_items,
        (SELECT count(*) FROM public.stories) AS stories,
        (SELECT count(*) FROM public.story_source_items) AS story_source_items
    `);

    assertSameValues(
      tables.rows.map((row) => row.relname),
      config.applicationTables,
      "application table",
    );
    assertSameValues(
      enums.rows.map((row) => row.typname),
      config.enumTypes,
      "enum type",
    );
    assertSameValues(
      indexes.rows.map((row) => row.indexname),
      config.explicitIndexes,
      "explicit index",
    );

    const constraintsByType = new Map([
      ["p", config.primaryKeys],
      ["u", config.uniqueConstraints],
      ["c", config.checkConstraints],
      ["f", config.foreignKeys],
    ]);
    for (const [type, expected] of constraintsByType) {
      const matching = constraints.rows.filter((row) => row.contype === type);
      assertSameValues(
        matching.map((row) => row.conname),
        expected,
        `${type} constraint`,
      );
      if (matching.some((row) => row.convalidated !== true)) {
        stop("An application constraint is not validated.");
      }
    }
    const foreignKeys = constraints.rows.filter((row) => row.contype === "f");
    if (
      foreignKeys.some(
        (row) => row.confdeltype !== "r" || row.confupdtype !== "a",
      )
    ) {
      stop("Foreign-key referential actions do not match the reviewed migration.");
    }
    if (
      constraints.rows
        .filter((row) => row.contype === "p" || row.contype === "u")
        .some((row) => row.has_backing_index !== true)
    ) {
      stop("A primary or unique constraint has no backing index.");
    }

    if (
      history.rowCount !== 1 ||
      history.rows[0]?.hash !== config.migrationSha256 ||
      Number(history.rows[0]?.created_at) !== config.migrationTimestamp
    ) {
      stop("Drizzle migration history does not match the reviewed migration.");
    }
    if (
      authCatalog.tableCount !== before.authCatalog.tableCount ||
      authCatalog.fingerprint !== before.authCatalog.fingerprint
    ) {
      stop("The managed neon_auth catalog changed during migration.");
    }
    if (
      Object.values(residue.rows[0] ?? {}).some((count) => Number(count) !== 0)
    ) {
      stop("The initial application tables unexpectedly contain rows.");
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function requireInteractiveConfirmation() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    stop("Production migration execution requires an interactive terminal.");
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(
      `Type this exact confirmation phrase:\n${config.confirmationPhrase}\n> `,
    );
    if (answer !== config.confirmationPhrase) {
      stop("Confirmation did not match; no migration was executed.");
    }
  } finally {
    prompt.close();
  }
}

async function main() {
  let stage = "local safeguards";
  let schemaModificationStarted = false;
  let client;
  let pool;

  try {
    const mode = parseCommandMode(process.argv.slice(2));
    assertCredentialFileIsIgnored();
    const artifact = await readAndVerifyMigration();
    const credential = await loadProductionCredential(projectRoot);

    stage = "read-only production preflight";
    pool = new Pool({
      connectionString: credential.connectionString,
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 30_000,
      max: 1,
    });
    client = await pool.connect();
    await client.query("SET statement_timeout TO '30s'");
    await client.query("SET lock_timeout TO '10s'");
    await client.query("SET idle_in_transaction_session_timeout TO '30s'");

    const before = await inspectBeforeMigration(client);
    console.log(
      `Preflight passed for ${config.endpoint}/${config.database}; migration ${artifact.sha256} is unchanged.`,
    );

    if (mode === "preflight") {
      console.log("Read-only preflight complete. No schema changes were attempted.");
      return;
    }

    stage = "interactive confirmation";
    await requireInteractiveConfirmation();

    stage = "final read-only preflight";
    await readAndVerifyMigration();
    const finalBefore = await inspectBeforeMigration(client);
    if (finalBefore.authCatalog.fingerprint !== before.authCatalog.fingerprint) {
      stop("The managed neon_auth catalog changed while awaiting confirmation.");
    }

    stage = "production migration";
    await client.query("SET search_path TO public");
    const searchPath = await client.query(`
      SELECT current_schema() AS current_schema, current_schemas(false) AS active_schemas
    `);
    if (
      searchPath.rows[0]?.current_schema !== "public" ||
      searchPath.rows[0]?.active_schemas?.includes("neon_auth")
    ) {
      stop("Could not pin the migration session to the public schema.");
    }

    schemaModificationStarted = true;
    const database = drizzle(client, { logger: false });
    await migrate(database, {
      migrationsFolder: path.join(projectRoot, "drizzle"),
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });

    stage = "post-migration verification";
    await verifyAfterMigration(client, before);
    console.log(
      `Migration and catalog verification succeeded for ${config.endpoint}/${config.database}.`,
    );
  } catch (error) {
    if (error instanceof ProductionMigrationGuardError) {
      console.error(`Stopped during ${stage}: ${error.message}`);
    } else {
      console.error(
        `Stopped during ${stage}. Provider diagnostics were withheld to protect credentials.`,
      );
    }
    if (schemaModificationStarted) {
      console.error(
        "A production schema change may have started. Do not rerun; inspect migration history and the catalog first.",
      );
    }
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool?.end().catch(() => undefined);
  }
}

await main();
