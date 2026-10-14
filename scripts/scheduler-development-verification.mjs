import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { Pool } from "@neondatabase/serverless";

import { loadDevelopmentCredential, sourceCatalogConfig } from "./source-catalog-guard.mjs";
import { VERIFIED_FEEDS } from "../src/server/ingestion/feed-catalog.ts";
import { collectFeedsWithRetry } from "../src/server/ingestion/feed-retry.ts";
import { runNewsCollection } from "../src/server/ingestion/run-collection.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function emptySuccessCollection() {
  return Object.freeze({
    failures: Object.freeze([]),
    successes: Object.freeze(VERIFIED_FEEDS.map((config) => Object.freeze({
      config,
      feed: Object.freeze({ format: "rss", items: Object.freeze([]) }),
    }))),
  });
}

async function main() {
  const credential = await loadDevelopmentCredential(projectRoot);
  process.env.DATABASE_URL = credential.pooledConnectionString;
  const direct = new Pool({ connectionString: credential.connectionString, max: 1 });

  try {
    const before = await direct.query("SELECT count(*)::integer AS count FROM public.source_items");
    const first = await runNewsCollection({
      collect: (signal) => collectFeedsWithRetry(VERIFIED_FEEDS, { signal }),
      expectedEndpoint: sourceCatalogConfig.developmentEndpoint,
      trigger: "manual",
    });
    if (!new Set(["succeeded", "partially_succeeded"]).has(first.status)) {
      throw new Error("The genuine development collection did not complete safely.");
    }
    const repeat = await runNewsCollection({
      collect: (signal) => collectFeedsWithRetry(VERIFIED_FEEDS, { signal }),
      expectedEndpoint: sourceCatalogConfig.developmentEndpoint,
      trigger: "manual",
    });
    if (repeat.insertedItems !== 0) {
      throw new Error("The repeated development collection inserted duplicate items.");
    }

    let releaseFirst;
    const barrier = new Promise((resolve) => { releaseFirst = resolve; });
    let signalStarted;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const firstConcurrent = runNewsCollection({
      collect: async () => {
        signalStarted();
        await barrier;
        return emptySuccessCollection();
      },
      expectedEndpoint: sourceCatalogConfig.developmentEndpoint,
      trigger: "manual",
    });
    await started;
    const overlapping = await runNewsCollection({
      collect: async () => { throw new Error("A skipped run must not fetch feeds."); },
      expectedEndpoint: sourceCatalogConfig.developmentEndpoint,
      trigger: "manual",
    });
    releaseFirst();
    const concurrentWinner = await firstConcurrent;
    if (overlapping.status !== "skipped" || concurrentWinner.status !== "succeeded") {
      throw new Error("Concurrent collection lease behavior was not enforced.");
    }

    const stale = await direct.query(`
      INSERT INTO public.collection_runs
        (trigger, status, lease_token, lease_expires_at, started_at)
      VALUES ('manual', 'running', gen_random_uuid(), now() - interval '1 minute', now() - interval '5 minutes')
      RETURNING id
    `);
    const recovered = await runNewsCollection({
      collect: async () => emptySuccessCollection(),
      expectedEndpoint: sourceCatalogConfig.developmentEndpoint,
      trigger: "manual",
    });
    const staleAfter = await direct.query(
      "SELECT status, failure_code FROM public.collection_runs WHERE id=$1",
      [stale.rows[0].id],
    );
    if (
      recovered.status !== "succeeded" ||
      staleAfter.rows[0]?.status !== "failed" ||
      staleAfter.rows[0]?.failure_code !== "lease_expired"
    ) {
      throw new Error("Expired collection lease recovery was not recorded.");
    }

    const partialCollection = emptySuccessCollection();
    const failedConfig = VERIFIED_FEEDS.at(-1);
    const partial = await runNewsCollection({
      collect: async () => ({
        failures: [{ reason: "controlled test failure", sourceKey: failedConfig.sourceKey }],
        successes: partialCollection.successes.slice(0, -1),
      }),
      expectedEndpoint: sourceCatalogConfig.developmentEndpoint,
      trigger: "manual",
    });
    if (partial.status !== "partially_succeeded" || partial.failedSources !== 1) {
      throw new Error("Per-source failure monitoring was not recorded.");
    }

    const verification = await direct.query(`
      SELECT
        (SELECT count(*)::integer FROM public.source_items) AS source_items,
        (SELECT count(*)::integer FROM public.collection_runs WHERE status='running') AS running_runs,
        (SELECT count(*)::integer FROM public.collection_runs WHERE status='skipped') AS skipped_runs,
        (SELECT count(*)::integer FROM public.collection_runs WHERE status='partially_succeeded') AS partial_runs,
        (SELECT count(*)::integer FROM (
          SELECT source_id, external_id FROM public.source_items WHERE external_id IS NOT NULL
          GROUP BY source_id, external_id HAVING count(*) > 1
          UNION ALL
          SELECT source_id, canonical_url FROM public.source_items
          GROUP BY source_id, canonical_url HAVING count(*) > 1
        ) duplicate_identities) AS duplicate_groups
    `);
    const result = verification.rows[0];
    if (
      Number(result.running_runs) !== 0 ||
      Number(result.duplicate_groups) !== 0 ||
      Number(result.skipped_runs) < 1 ||
      Number(result.partial_runs) < 1
    ) {
      throw new Error("Development collection verification found inconsistent run or item state.");
    }
    console.log(`Development scheduler verification passed: first=${first.status}, repeat inserted=0, concurrent skip recorded, expired lease recovered, source failure recorded.`);
    console.log(`Source items before=${before.rows[0].count}, after=${result.source_items}; duplicate identity groups=0; active leases=0.`);
  } finally {
    delete process.env.DATABASE_URL;
    await direct.end().catch(() => undefined);
  }
}

main().catch(() => {
  console.error("Development scheduler verification failed without exposing provider or database diagnostics.");
  process.exitCode = 1;
});
