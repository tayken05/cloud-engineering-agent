import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "@neondatabase/serverless";

import { aiContentMigrationConfig as config } from "./ai-content-migration.config.mjs";
import { intelligentNewsroomMigrationConfig } from "./intelligent-newsroom-migration.config.mjs";
import { loadDevelopmentCredential, sourceCatalogConfig } from "./source-catalog-guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const credential = await loadDevelopmentCredential(root);
assert.equal(credential.endpoint, sourceCatalogConfig.developmentEndpoint);
assert.equal(credential.database, "neondb");

const pool = new Pool({ connectionString: credential.connectionString, connectionTimeoutMillis: 15_000, max: 1 });
const client = await pool.connect();
const ownerId = `task13_test_${randomUUID().replaceAll("-", "_")}`;

async function authFingerprint() {
  const result = await client.query("SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='neon_auth' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum");
  return createHash("sha256").update(JSON.stringify(result.rows)).digest("hex");
}

try {
  await client.query("SET statement_timeout='30s'");
  await client.query("SET lock_timeout='5s'");
  const beforeAuth = await authFingerprint();
  const identity = (await client.query("SELECT current_database() database_name,current_schema() current_schema")).rows[0];
  assert.deepEqual(identity, { database_name: "neondb", current_schema: "public" });
  const history = (await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 1")).rows[0];
  assert.equal(history.hash, intelligentNewsroomMigrationConfig.migrationSha256);
  assert.equal(Number(history.created_at), intelligentNewsroomMigrationConfig.migrationTimestamp);
  const catalog = (await client.query("SELECT (SELECT count(*)::integer FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])) tables,(SELECT count(*)::integer FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname=ANY($2::text[]) AND t.typtype='e') enums", [config.tables, config.enums])).rows[0];
  assert.equal(catalog.tables, config.tables.length);
  assert.equal(catalog.enums, config.enums.length);

  await client.query("BEGIN");
  try {
    const run = (await client.query("INSERT INTO ai_generation_runs(owner_id,idempotency_key,kind,provider,model,request_fingerprint,requested_count,reserved_cost_microusd,lease_expires_at) VALUES($1,$2,'idea_batch','mock','mock-model',$3,3,1000,now()+interval '2 minutes') RETURNING id", [ownerId, `test:${randomUUID()}`, "a".repeat(64)])).rows[0];
    await client.query("SAVEPOINT concurrent_run");
    await assert.rejects(client.query("INSERT INTO ai_generation_runs(owner_id,idempotency_key,kind,provider,model,request_fingerprint,requested_count,reserved_cost_microusd,lease_expires_at) VALUES($1,$2,'draft','mock','mock-model',$3,1,1000,now()+interval '2 minutes')", [ownerId, `test:${randomUUID()}`, "b".repeat(64)]), (error) => error?.code === "23505");
    await client.query("ROLLBACK TO SAVEPOINT concurrent_run");
    await client.query("INSERT INTO ai_content_suggestions(run_id,owner_id,kind,ordinal,payload) VALUES($1,$2,'idea_batch',0,$3::jsonb)", [run.id, ownerId, JSON.stringify({ title: "transactional test" })]);
    await client.query("SAVEPOINT invalid_acceptance");
    await assert.rejects(client.query("UPDATE ai_content_suggestions SET editorial_status='accepted' WHERE run_id=$1", [run.id]), (error) => error?.code === "23514");
    await client.query("ROLLBACK TO SAVEPOINT invalid_acceptance");
  } finally {
    await client.query("ROLLBACK");
  }
  const retained = (await client.query("SELECT (SELECT count(*)::integer FROM ai_generation_runs WHERE owner_id=$1) runs,(SELECT count(*)::integer FROM ai_content_suggestions WHERE owner_id=$1) suggestions,(SELECT count(*)::integer FROM ai_generation_evidence WHERE owner_id=$1) evidence", [ownerId])).rows[0];
  assert.deepEqual(retained, { evidence: 0, runs: 0, suggestions: 0 });
  assert.equal(await authFingerprint(), beforeAuth);
  const editorialStatuses = (await client.query("SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='content_draft_status' ORDER BY e.enumsortorder")).rows.map((row) => row.enumlabel);
  assert.deepEqual(editorialStatuses, ["draft", "ready_for_review", "needs_review", "approved", "rejected"]);
  console.log("Development AI-content verification passed: exact migration history, editorial states, tables, enums, concurrency uniqueness, rollback cleanup, and managed Auth preservation.");
} finally {
  client.release();
  await pool.end();
}
