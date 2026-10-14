import "server-only";

import { VERIFIED_FEEDS } from "./feed-catalog.ts";
import { collectFeedsWithRetry } from "./feed-retry.ts";
import type { FeedCollectionResult } from "./feed-fetcher.ts";
import {
  createCollectionRunStore,
  type CollectionRunStore,
  type CollectionTrigger,
} from "./collection-store.ts";

export const PRODUCTION_DATABASE_ENDPOINT = "ep-spring-grass-b7iye83x";

export type CollectionExecutionResult = Readonly<{
  failedSources: number;
  insertedItems: number;
  runId: string;
  status: "failed" | "partially_succeeded" | "skipped" | "succeeded";
  successfulSources: number;
  unchangedItems: number;
  updatedItems: number;
}>;

type CollectionFunction = (
  signal?: AbortSignal,
) => Promise<FeedCollectionResult>;

export async function runNewsCollection(
  options: Readonly<{
    collect?: CollectionFunction;
    expectedEndpoint?: string;
    now?: () => Date;
    signal?: AbortSignal;
    store?: CollectionRunStore;
    trigger: CollectionTrigger;
  }>,
): Promise<CollectionExecutionResult> {
  const now = options.now ?? (() => new Date());
  const store = options.store ?? await createCollectionRunStore({
    expectedEndpoint: options.expectedEndpoint,
  });
  let activeLease: Awaited<ReturnType<CollectionRunStore["acquire"]>> | undefined;
  let collection: FeedCollectionResult | undefined;

  try {
    activeLease = await store.acquire(options.trigger, now());
    if (!activeLease.acquired) {
      return Object.freeze({
        failedSources: 0,
        insertedItems: 0,
        runId: activeLease.runId,
        status: "skipped",
        successfulSources: 0,
        unchangedItems: 0,
        updatedItems: 0,
      });
    }

    collection = options.collect
      ? await options.collect(options.signal)
      : await collectFeedsWithRetry(VERIFIED_FEEDS, { signal: options.signal });
    const failedSourceKeys = collection.failures.map((failure) => failure.sourceKey);
    const processedSourceKeys = VERIFIED_FEEDS.map((feed) => feed.sourceKey);
    const status = collection.successes.length === 0
      ? "failed"
      : failedSourceKeys.length > 0
        ? "partially_succeeded"
        : "succeeded";
    const finalMetrics = { failedSourceKeys, processedSourceKeys, status } as const;
    const counts = collection.successes.length === 0
      ? await store.finishWithoutItems(activeLease, now(), finalMetrics)
      : await store.persistAndFinish(activeLease, collection, now(), finalMetrics);

    return Object.freeze({
      failedSources: failedSourceKeys.length,
      insertedItems: counts.insertedCount,
      runId: activeLease.runId,
      status,
      successfulSources: collection.successes.length,
      unchangedItems: counts.unchangedCount,
      updatedItems: counts.updatedCount,
    });
  } catch (error) {
    if (activeLease?.acquired) {
      const processed = collection ? VERIFIED_FEEDS.map((feed) => feed.sourceKey) : [];
      const failed = collection?.failures.map((failure) => failure.sourceKey) ?? [];
      await store.fail(
        activeLease,
        now(),
        collection ? "persistence_failed" : "collection_failed",
        processed,
        failed,
      ).catch(() => undefined);
    }
    throw error;
  } finally {
    await store.close().catch(() => undefined);
  }
}
