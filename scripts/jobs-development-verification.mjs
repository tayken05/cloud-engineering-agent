import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "@neondatabase/serverless";

import { migrationHistoryMatches } from "./migration-history-guard.mjs";
import { loadDevelopmentCredential } from "./source-catalog-guard.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function expectConstraint(client, name, query, expectedCode) {
  await client.query(`SAVEPOINT ${name}`);
  try {
    await client.query(query);
    assert.fail(`${name} unexpectedly accepted invalid data.`);
  } catch (error) {
    assert.equal(error?.code, expectedCode, `${name} returned an unexpected PostgreSQL error code.`);
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    await client.query(`RELEASE SAVEPOINT ${name}`);
  }
}

async function verifyDatabase(connectionString) {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 15_000, max: 1 });
  let client;
  try {
    client = await pool.connect();
    await client.query("SET statement_timeout='30s'");
    const history = await client.query("SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id");
    assert.equal(migrationHistoryMatches(history.rows), true);
    const counts = (await client.query(`SELECT
      (SELECT count(*)::integer FROM public.job_employers) AS employers,
      (SELECT count(*)::integer FROM public.job_sources) AS sources,
      (SELECT count(*)::integer FROM public.jobs) AS jobs,
      (SELECT count(*)::integer FROM (SELECT source_id,external_id,count(*) FROM public.jobs GROUP BY source_id,external_id HAVING count(*)>1) duplicates) AS duplicates,
      (SELECT count(*)::integer FROM public.jobs WHERE status='unverified') AS unverified`)).rows[0];
    assert.deepEqual(counts, { employers: 4, sources: 4, jobs: 11, duplicates: 0, unverified: 0 });
    const filters = (await client.query(`SELECT
      count(*) FILTER (WHERE j.category='linux')::integer AS linux,
      count(*) FILTER (WHERE j.country_code='NG')::integer AS nigeria,
      count(*) FILTER (WHERE e.slug='supabase')::integer AS supabase,
      count(*) FILTER (WHERE j.experience_level='entry_level')::integer AS entry_level,
      count(*) FILTER (WHERE j.salary_currency IS NOT NULL)::integer AS salary_disclosed,
      count(*) FILTER (WHERE j.specialization='Linux kernel engineering')::integer AS kernel_specialization,
      count(*) FILTER (WHERE j.slug='canonical-junior-linux-kernel-engineer' AND e.name='Canonical')::integer AS detail
      FROM public.jobs j
      JOIN public.job_sources s ON s.id=j.source_id
      JOIN public.job_employers e ON e.id=s.employer_id
      WHERE j.status='open'`)).rows[0];
    assert.deepEqual(filters, {
      linux: 2, nigeria: 3, supabase: 3, entry_level: 2,
      salary_disclosed: 1, kernel_specialization: 1, detail: 1,
    });

    await client.query("BEGIN");
    try {
      await expectConstraint(client, "duplicate_slug", "UPDATE public.jobs SET slug=(SELECT slug FROM public.jobs ORDER BY slug LIMIT 1) WHERE id=(SELECT id FROM public.jobs ORDER BY slug DESC LIMIT 1)", "23505");
      await expectConstraint(client, "invalid_url", "UPDATE public.jobs SET application_url='http://unsafe.example' WHERE id=(SELECT id FROM public.jobs LIMIT 1)", "23514");
      await expectConstraint(client, "country_pair", "UPDATE public.jobs SET country_code='NG',country_name=NULL WHERE id=(SELECT id FROM public.jobs LIMIT 1)", "23514");
      await expectConstraint(client, "foreign_key", "UPDATE public.jobs SET source_id='00000000-0000-0000-0000-000000000000' WHERE id=(SELECT id FROM public.jobs LIMIT 1)", "23503");
    } finally {
      await client.query("ROLLBACK");
    }
    const after = (await client.query("SELECT count(*)::integer AS jobs FROM public.jobs")).rows[0];
    assert.equal(after.jobs, 11);
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

const credential = await loadDevelopmentCredential(projectRoot);
await verifyDatabase(credential.connectionString);
console.log("Development jobs verification passed: migration history, 4 employers, 4 sources, 11 jobs, constraints, filters, detail lookup, and rollback isolation.");
