import "server-only";

import { randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { and, eq, lte } from "drizzle-orm";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import { getDatabaseUrl } from "../db/environment.ts";
import * as schema from "../db/schema.ts";
import { collectionRuns } from "../db/schema.ts";
import type { FeedCollectionResult } from "./feed-fetcher.ts";
import {
  persistCollectedFeeds,
  type DatabaseTransaction,
  type PersistenceCounts,
} from "./source-item-persistence.ts";

export const COLLECTION_LEASE_MS = 4 * 60 * 1_000;
const CONNECTION_TIMEOUT_MS = 15_000;

export type CollectionTrigger = "manual" | "scheduled";
export type CollectionRunStatus =
  | "failed"
  | "partially_succeeded"
  | "skipped"
  | "succeeded";

export type CollectionLease = Readonly<{
  acquired: true;
  leaseToken: string;
  runId: string;
}>;

export type SkippedCollectionLease = Readonly<{
  acquired: false;
  runId: string;
}>;

export type FinalCollectionMetrics = PersistenceCounts & Readonly<{
  failedSourceKeys: readonly string[];
  processedSourceKeys: readonly string[];
  status: Exclude<CollectionRunStatus, "skipped">;
}>;

export type CollectionRunStore = Readonly<{
  acquire(trigger: CollectionTrigger, startedAt: Date): Promise<CollectionLease | SkippedCollectionLease>;
  close(): Promise<void>;
  fail(
    lease: CollectionLease,
    finishedAt: Date,
    failureCode: string,
    processedSourceKeys?: readonly string[],
    failedSourceKeys?: readonly string[],
  ): Promise<void>;
  finishWithoutItems(
    lease: CollectionLease,
    finishedAt: Date,
    metrics: Omit<FinalCollectionMetrics, keyof PersistenceCounts>,
  ): Promise<PersistenceCounts>;
  persistAndFinish(
    lease: CollectionLease,
    collection: FeedCollectionResult,
    finishedAt: Date,
    metrics: Omit<FinalCollectionMetrics, keyof PersistenceCounts>,
  ): Promise<PersistenceCounts>;
}>;

export class CollectionLeaseLostError extends Error {
  constructor() {
    super("The collection lease is no longer active.");
    this.name = "CollectionLeaseLostError";
  }
}

function assertRuntimeDatabaseUrl(value: string, expectedEndpoint?: string): string {
  const url = new URL(value);
  const hostLabel = url.hostname.split(".")[0]?.toLowerCase();
  if (!hostLabel?.endsWith("-pooler")) {
    throw new Error("Scheduled collection requires a pooled Neon database connection.");
  }
  const endpoint = hostLabel.slice(0, -"-pooler".length);
  if (expectedEndpoint && endpoint !== expectedEndpoint) {
    throw new Error("Scheduled collection refused an unexpected database endpoint.");
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (database !== "neondb") {
    throw new Error("Scheduled collection requires the expected database.");
  }
  return value;
}

function completedValues(
  metrics: Omit<FinalCollectionMetrics, keyof PersistenceCounts>,
  counts: PersistenceCounts,
  finishedAt: Date,
) {
  return {
    failureCode: metrics.status === "failed"
      ? "all_sources_failed"
      : metrics.status === "partially_succeeded"
        ? "publisher_failures"
        : null,
    failedSourceKeys: [...metrics.failedSourceKeys],
    finishedAt,
    itemsInserted: counts.insertedCount,
    itemsUnchanged: counts.unchangedCount,
    itemsUpdated: counts.updatedCount,
    leaseExpiresAt: null,
    leaseToken: null,
    processedSourceKeys: [...metrics.processedSourceKeys],
    sourcesAttempted: metrics.processedSourceKeys.length,
    sourcesFailed: metrics.failedSourceKeys.length,
    sourcesSucceeded: metrics.processedSourceKeys.length - metrics.failedSourceKeys.length,
    status: metrics.status,
    updatedAt: finishedAt,
  };
}

async function assertActiveLease(
  transaction: DatabaseTransaction,
  lease: CollectionLease,
  now: Date,
) {
  const [active] = await transaction
    .select({
      leaseExpiresAt: collectionRuns.leaseExpiresAt,
    })
    .from(collectionRuns)
    .where(and(
      eq(collectionRuns.id, lease.runId),
      eq(collectionRuns.leaseToken, lease.leaseToken),
      eq(collectionRuns.status, "running"),
    ))
    .for("update");
  if (!active?.leaseExpiresAt || active.leaseExpiresAt <= now) {
    throw new CollectionLeaseLostError();
  }
}

class PostgresCollectionRunStore implements CollectionRunStore {
  private readonly database: NeonDatabase<typeof schema>;
  private readonly pool: Pool;

  constructor(
    database: NeonDatabase<typeof schema>,
    pool: Pool,
  ) {
    this.database = database;
    this.pool = pool;
  }

  async acquire(trigger: CollectionTrigger, startedAt: Date) {
    return this.database.transaction(async (transaction) => {
      await transaction
        .update(collectionRuns)
        .set({
          failureCode: "lease_expired",
          finishedAt: startedAt,
          leaseExpiresAt: null,
          leaseToken: null,
          status: "failed",
          updatedAt: startedAt,
        })
        .where(and(
          eq(collectionRuns.status, "running"),
          lte(collectionRuns.leaseExpiresAt, startedAt),
        ));

      const leaseToken = randomUUID();
      const [acquired] = await transaction
        .insert(collectionRuns)
        .values({
          leaseExpiresAt: new Date(startedAt.getTime() + COLLECTION_LEASE_MS),
          leaseToken,
          startedAt,
          trigger,
        })
        .onConflictDoNothing()
        .returning({ id: collectionRuns.id });
      if (acquired) {
        return Object.freeze({ acquired: true as const, leaseToken, runId: acquired.id });
      }

      const [skipped] = await transaction
        .insert(collectionRuns)
        .values({
          failureCode: "active_lease",
          finishedAt: startedAt,
          startedAt,
          status: "skipped",
          trigger,
        })
        .returning({ id: collectionRuns.id });
      if (!skipped) throw new Error("The skipped collection run was not recorded.");
      return Object.freeze({ acquired: false as const, runId: skipped.id });
    });
  }

  async persistAndFinish(
    lease: CollectionLease,
    collection: FeedCollectionResult,
    finishedAt: Date,
    metrics: Omit<FinalCollectionMetrics, keyof PersistenceCounts>,
  ) {
    return persistCollectedFeeds(this.database, collection, finishedAt, {
      beforeWrite: async (transaction) => assertActiveLease(transaction, lease, finishedAt),
      beforeCommit: async (transaction, counts) => {
        const [completed] = await transaction
          .update(collectionRuns)
          .set(completedValues(metrics, counts, finishedAt))
          .where(and(
            eq(collectionRuns.id, lease.runId),
            eq(collectionRuns.leaseToken, lease.leaseToken),
            eq(collectionRuns.status, "running"),
          ))
          .returning({ id: collectionRuns.id });
        if (!completed) throw new CollectionLeaseLostError();
      },
    });
  }

  async finishWithoutItems(
    lease: CollectionLease,
    finishedAt: Date,
    metrics: Omit<FinalCollectionMetrics, keyof PersistenceCounts>,
  ) {
    const counts = Object.freeze({ insertedCount: 0, unchangedCount: 0, updatedCount: 0 });
    return this.database.transaction(async (transaction) => {
      await assertActiveLease(transaction, lease, finishedAt);
      const [completed] = await transaction
        .update(collectionRuns)
        .set(completedValues(metrics, counts, finishedAt))
        .where(and(
          eq(collectionRuns.id, lease.runId),
          eq(collectionRuns.leaseToken, lease.leaseToken),
          eq(collectionRuns.status, "running"),
        ))
        .returning({ id: collectionRuns.id });
      if (!completed) throw new CollectionLeaseLostError();
      return counts;
    });
  }

  async fail(
    lease: CollectionLease,
    finishedAt: Date,
    failureCode: string,
    processedSourceKeys: readonly string[] = [],
    failedSourceKeys: readonly string[] = [],
  ) {
    await this.database
      .update(collectionRuns)
      .set({
        ...completedValues({
          failedSourceKeys,
          processedSourceKeys,
          status: "failed",
        }, { insertedCount: 0, unchangedCount: 0, updatedCount: 0 }, finishedAt),
        failureCode,
      })
      .where(and(
        eq(collectionRuns.id, lease.runId),
        eq(collectionRuns.leaseToken, lease.leaseToken),
        eq(collectionRuns.status, "running"),
      ));
  }

  async close() {
    await this.pool.end();
  }
}

export async function createCollectionRunStore(
  options: Readonly<{ expectedEndpoint?: string }> = {},
): Promise<CollectionRunStore> {
  const connectionString = assertRuntimeDatabaseUrl(
    getDatabaseUrl(),
    options.expectedEndpoint,
  );
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query("SET statement_timeout = '20s'");
    await client.query("SET lock_timeout = '5s'");
  } finally {
    client.release();
  }
  return new PostgresCollectionRunStore(drizzle(pool, { schema }), pool);
}
