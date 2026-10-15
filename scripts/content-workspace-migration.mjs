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
import { approvedMigrationHistory } from "./migration-history-guard.mjs";
import { contentWorkspaceMigrationConfig as config } from "./content-workspace-migration.config.mjs";
import { ContentWorkspaceMigrationGuardError, parseContentWorkspaceMigrationCommand, validateContentWorkspaceMigration } from "./content-workspace-migration-guard.mjs";
import { loadProductionCredential } from "./production-migration-guard.mjs";
import { productionMigrationConfig } from "./production-migration.config.mjs";
import { loadDevelopmentCredential, sourceCatalogConfig } from "./source-catalog-guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let stage = "startup";
function stop(message) { throw new ContentWorkspaceMigrationGuardError(message); }
function ignored(file) { if (spawnSync("git", ["check-ignore", "--quiet", "--", file], { cwd: root, stdio: "ignore" }).status !== 0) stop(`${file} must be ignored by Git.`); }
async function artifacts() { const [sql, journalText] = await Promise.all([readFile(path.join(root, config.migrationFile), "utf8"), readFile(path.join(root, "drizzle/meta/_journal.json"), "utf8")]); return validateContentWorkspaceMigration(sql, JSON.parse(journalText)); }
async function authFingerprint(client) { const rows = await client.query("SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum"); return { count: new Set(rows.rows.map((row) => row.relname)).size, hash: createHash("sha256").update(JSON.stringify(rows.rows)).digest("hex") }; }
function historyMatches(rows, length) { return rows.length === length && rows.every((row, index) => row.hash === approvedMigrationHistory[index]?.hash && Number(row.created_at) === approvedMigrationHistory[index]?.timestamp); }
async function inspect(client, production) {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    const identity = (await client.query("SELECT current_database() database_name,current_schema() current_schema,current_schemas(false) schemas")).rows[0];
    if (identity?.database_name !== "neondb" || identity.current_schema !== "public" || identity.schemas?.includes("neon_auth")) stop("The database identity or search path is unsafe.");
    const history = (await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
    if (!historyMatches(history, 4) && !historyMatches(history, 5)) stop("Migration history does not match the reviewed baseline.");
    const existing = (await client.query("SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname=ANY($1::text[]) ORDER BY c.relname", [config.tables])).rows.map((row) => row.relname);
    if ((history.length === 5) !== (existing.length === config.tables.length)) stop("Content-workspace objects conflict with migration history.");
    if (existing.length !== 0 && existing.length !== config.tables.length) stop("Only part of the content-workspace schema exists.");
    const counts = (await client.query("SELECT (SELECT count(*)::integer FROM sources) sources,(SELECT count(*)::integer FROM source_items) source_items,(SELECT count(*)::integer FROM jobs) jobs,(SELECT count(*)::integer FROM collection_runs) collection_runs,(SELECT count(*)::integer FROM job_discovery_runs) job_runs")).rows[0];
    const auth = await authFingerprint(client); if (production && auth.count !== productionMigrationConfig.expectedAuthTableCount) stop("The managed authentication catalog differs from the verified baseline.");
    await client.query("COMMIT"); return { applied: history.length === 5, auth, counts };
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
}
async function verify(client, before, production) {
  const after = await inspect(client, production); if (!after.applied) stop("The migration was not recorded.");
  for (const [key, value] of Object.entries(before.counts)) if (Number(after.counts[key]) !== Number(value)) stop("Existing application row counts changed during migration.");
  if (after.auth.hash !== before.auth.hash) stop("The managed authentication catalog changed during migration.");
  const result = (await client.query("SELECT (SELECT count(*)::integer FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])) tables,(SELECT count(*)::integer FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname LIKE 'content_%' AND t.typtype='e') enums,(SELECT count(*)::integer FROM content_ideas) ideas,(SELECT count(*)::integer FROM content_drafts) drafts", [config.tables])).rows[0];
  if (Number(result.tables) !== 6 || Number(result.enums) !== 8 || Number(result.ideas) !== 0 || Number(result.drafts) !== 0) stop("The migrated content catalog does not match the reviewed empty schema.");
}
async function confirm() { if (!process.stdin.isTTY || !process.stdout.isTTY) stop("Production migration requires an interactive terminal."); const ui=createInterface({input:process.stdin,output:process.stdout}); try { if (await ui.question(`Type exactly: ${config.confirmationPhrase}\n> `) !== config.confirmationPhrase) stop("Production confirmation did not match."); } finally { ui.close(); } }
async function main() {
  const command=parseContentWorkspaceMigrationCommand(process.argv.slice(2)); const production=command.environment==="production"; stage="artifact validation"; await artifacts();
  const file=production?productionMigrationConfig.credentialFile:sourceCatalogConfig.developmentCredentialFile; ignored(file);
  stage="credential validation"; const credential=production?await loadProductionCredential(root):await loadDevelopmentCredential(root); const endpoint=production?productionMigrationConfig.endpoint:sourceCatalogConfig.developmentEndpoint;
  if (credential.endpoint!==endpoint || credential.database!=="neondb") stop("The direct credential does not match the selected exact endpoint.");
  const pool=new Pool({connectionString:credential.connectionString,connectionTimeoutMillis:15_000,max:1}); let client;
  try { stage="database connection"; client=await pool.connect(); await client.query("SET statement_timeout='30s'"); await client.query("SET lock_timeout='5s'"); stage="database preflight"; const before=await inspect(client,production); console.log(`${command.environment} preflight passed: exact direct endpoint, migration history, schema boundary, and managed authentication catalog.`); console.log(`Content-workspace migration status: ${before.applied?"already applied":"pending"}.`); if(command.mode==="preflight")return; if(production&&!before.applied)await confirm(); stage="migration execution"; await migrate(drizzle(client),{migrationsFolder:path.join(root,"drizzle")}); stage="post-migration verification"; await verify(client,before,production); console.log("Content-workspace migration verified; existing application rows and managed authentication were unchanged."); }
  finally { client?.release(); await pool.end().catch(()=>undefined); }
}
main().catch((error)=>{ console.error(error instanceof ContentWorkspaceMigrationGuardError?`Content-workspace migration stopped: ${error.message}`:`Content-workspace migration failed during ${stage}; database diagnostics were withheld.`); process.exitCode=1; });
