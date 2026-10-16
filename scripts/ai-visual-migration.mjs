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

import { AiVisualMigrationGuardError, parseAiVisualMigrationCommand, validateAiVisualMigration } from "./ai-visual-migration-guard.mjs";
import { aiVisualMigrationConfig as config } from "./ai-visual-migration.config.mjs";
import { approvedMigrationHistory } from "./migration-history-guard.mjs";
import { loadProductionCredential } from "./production-migration-guard.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";
import { loadDevelopmentCredential, sourceCatalogConfig } from "./source-catalog-guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let stage = "startup";
function stop(message) { throw new AiVisualMigrationGuardError(message); }
function ignored(file) { if (spawnSync("git", ["check-ignore", "--quiet", "--", file], { cwd: root, stdio: "ignore" }).status !== 0) stop(`${file} must be ignored by Git.`); }
async function artifacts() {
  const [sql, journalText] = await Promise.all([readFile(path.join(root, config.migrationFile), "utf8"), readFile(path.join(root, "drizzle/meta/_journal.json"), "utf8")]);
  return validateAiVisualMigration(sql, JSON.parse(journalText));
}
async function authFingerprint(client) {
  const rows = await client.query("SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum");
  return { count: new Set(rows.rows.map((row) => row.relname)).size, hash: createHash("sha256").update(JSON.stringify(rows.rows)).digest("hex") };
}
function historyMatches(rows, length) { return rows.length === length && rows.every((row, index) => row.hash === approvedMigrationHistory[index]?.hash && Number(row.created_at) === approvedMigrationHistory[index]?.timestamp); }
async function inspect(client, production) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    const identity = (await client.query("SELECT current_database() database_name,current_schema() current_schema,current_schemas(false) schemas")).rows[0];
    if (identity?.database_name !== "neondb" || identity.current_schema !== "public" || identity.schemas?.includes("neon_auth")) stop("The database identity or search path is unsafe.");
    const history = (await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
    if (!historyMatches(history, 6) && !historyMatches(history, 7)) stop("Migration history does not match the reviewed baseline.");
    const applied = history.length === 7;
    const structure = (await client.query("SELECT to_regclass('public.content_media_assets') media_table, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='content_drafts' AND column_name='media_path') media_column, EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='ai_generation_kind' AND e.enumlabel='image') image_kind")).rows[0];
    if (applied !== Boolean(structure.media_table && structure.media_column && structure.image_kind)) stop("AI-visual objects conflict with migration history.");
    if (!applied && (structure.media_table || structure.media_column || structure.image_kind)) stop("Untracked AI-visual objects already exist.");
    const counts = (await client.query("SELECT (SELECT count(*)::integer FROM content_ideas) ideas,(SELECT count(*)::integer FROM content_drafts) drafts,(SELECT count(*)::integer FROM ai_generation_runs) runs,(SELECT count(*)::integer FROM ai_content_suggestions) suggestions,(SELECT count(*)::integer FROM jobs) jobs,(SELECT count(*)::integer FROM source_items) source_items")).rows[0];
    const auth = await authFingerprint(client);
    if (production && auth.count !== productionMigrationConfig.expectedAuthTableCount) stop("The managed authentication catalog differs from the verified baseline.");
    await client.query("COMMIT");
    return { applied, auth, counts };
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
}
async function confirm() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) stop("Production migration requires an interactive terminal.");
  const ui = createInterface({ input: process.stdin, output: process.stdout });
  try { if (await ui.question(`Type exactly: ${config.confirmationPhrase}\n> `) !== config.confirmationPhrase) stop("Production confirmation did not match."); }
  finally { ui.close(); }
}
async function main() {
  const command = parseAiVisualMigrationCommand(process.argv.slice(2));
  const production = command.environment === "production";
  stage = "artifact validation"; await artifacts();
  const file = production ? productionMigrationConfig.credentialFile : sourceCatalogConfig.developmentCredentialFile;
  ignored(file);
  stage = "credential validation";
  const credential = production ? await loadProductionCredential(root) : await loadDevelopmentCredential(root);
  const endpoint = production ? productionMigrationConfig.endpoint : sourceCatalogConfig.developmentEndpoint;
  if (credential.endpoint !== endpoint || credential.database !== "neondb" || credential.pooled) stop("The direct credential does not match the selected exact endpoint.");
  const pool = new Pool({ connectionString: credential.connectionString, connectionTimeoutMillis: 15_000, max: 1 });
  let client;
  try {
    stage = "database connection"; client = await pool.connect();
    await client.query("SET statement_timeout='30s'"); await client.query("SET lock_timeout='5s'");
    stage = "database preflight"; const before = await inspect(client, production);
    console.log(`${command.environment} AI-visual preflight passed: exact direct endpoint, reviewed history, public schema boundary, and managed authentication catalog.`);
    console.log(`AI-visual migration status: ${before.applied ? "already applied" : "pending"}.`);
    if (command.mode === "preflight") return;
    if (production && !before.applied) await confirm();
    stage = "migration execution"; await migrate(drizzle(client), { migrationsFolder: path.join(root, "drizzle") });
    stage = "post-migration verification"; const after = await inspect(client, production);
    if (!after.applied) stop("The AI-visual migration was not recorded.");
    for (const [key, value] of Object.entries(before.counts)) if (Number(after.counts[key]) !== Number(value)) stop("Existing application row counts changed during migration.");
    if (after.auth.hash !== before.auth.hash) stop("The managed authentication catalog changed during migration.");
    console.log("AI-visual migration verified; existing content, intelligence, jobs, and managed authentication records were unchanged.");
  } finally { client?.release(); await pool.end().catch(() => undefined); }
}

main().catch((error) => {
  console.error(error instanceof AiVisualMigrationGuardError ? `AI-visual migration stopped: ${error.message}` : `AI-visual migration failed during ${stage}; database diagnostics were withheld.`);
  process.exitCode = 1;
});
