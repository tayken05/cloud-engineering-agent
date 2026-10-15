import "server-only";

import type { CollectionTrigger } from "../../ingestion/collection-store.ts";
import { PRODUCTION_DATABASE_ENDPOINT } from "../../ingestion/run-collection.ts";
import { collectEmployerBoards } from "./collect-boards.ts";
import { createJobDiscoveryStore, type JobDiscoveryStore } from "./job-discovery-store.ts";
import type { DiscoveryResult } from "./types.ts";

export { PRODUCTION_DATABASE_ENDPOINT };

export type JobDiscoveryExecution = Readonly<{
  closedJobs: number;
  failedSources: number;
  insertedJobs: number;
  pendingVerificationJobs: number;
  runId: string;
  status: "failed" | "partially_succeeded" | "skipped" | "succeeded";
  successfulSources: number;
  unchangedJobs: number;
  updatedJobs: number;
  verifiedJobs: number;
}>;

export async function runJobDiscovery(options: Readonly<{
  collect?: (signal?: AbortSignal) => Promise<DiscoveryResult>;
  connectionString?: string;
  expectedEndpoint?: string;
  mode?: "direct" | "pooled";
  now?: () => Date;
  signal?: AbortSignal;
  store?: JobDiscoveryStore;
  trigger: CollectionTrigger;
}>): Promise<JobDiscoveryExecution> {
  const now = options.now ?? (() => new Date());
  const store = options.store ?? await createJobDiscoveryStore({
    connectionString: options.connectionString, expectedEndpoint: options.expectedEndpoint, mode: options.mode,
  });
  let lease: Awaited<ReturnType<JobDiscoveryStore["acquire"]>> | undefined;
  try {
    lease = await store.acquire(options.trigger, now());
    if (!lease.acquired) return Object.freeze({
      closedJobs: 0, failedSources: 0, insertedJobs: 0, pendingVerificationJobs: 0, runId: lease.runId,
      status: "skipped", successfulSources: 0, unchangedJobs: 0, updatedJobs: 0, verifiedJobs: 0,
    });
    const result = options.collect ? await options.collect(options.signal) : await collectEmployerBoards(undefined, { signal: options.signal });
    const counts = await store.persistAndFinish(lease, result, now());
    return Object.freeze({
      closedJobs: counts.closed, failedSources: result.failures.length, insertedJobs: counts.inserted,
      pendingVerificationJobs: counts.pendingVerification, runId: lease.runId,
      status: result.successes.length === 0 ? "failed" : result.failures.length ? "partially_succeeded" : "succeeded",
      successfulSources: result.successes.length, unchangedJobs: counts.unchanged, updatedJobs: counts.updated, verifiedJobs: counts.verified,
    });
  } catch (error) {
    if (lease?.acquired) await store.fail(lease, now(), "discovery_failed").catch(() => undefined);
    throw error;
  } finally { await store.close().catch(() => undefined); }
}
