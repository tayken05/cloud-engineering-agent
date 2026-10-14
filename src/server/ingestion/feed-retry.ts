import "server-only";

import { setTimeout as wait } from "node:timers/promises";

import type { FeedSourceConfig } from "./feed-catalog.ts";
import {
  collectFeeds,
  type CollectedFeed,
  type FeedCollectionResult,
} from "./feed-fetcher.ts";

export const FEED_RETRY_LIMIT = 1;
export const FEED_RETRY_DELAY_MS = 750;

type Collector = typeof collectFeeds;

export async function collectFeedsWithRetry(
  configs: readonly FeedSourceConfig[],
  options: Readonly<{
    collect?: Collector;
    delay?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
    signal?: AbortSignal;
  }> = {},
): Promise<FeedCollectionResult> {
  const collect = options.collect ?? collectFeeds;
  const first = await collect(configs, { signal: options.signal });
  if (first.failures.length === 0) return first;

  const failedKeys = new Set(first.failures.map((failure) => failure.sourceKey));
  const retryConfigs = configs.filter((config) => failedKeys.has(config.sourceKey));
  const delay = options.delay ?? (async (milliseconds, signal) => {
    await wait(milliseconds, undefined, { signal });
  });
  await delay(FEED_RETRY_DELAY_MS, options.signal);
  const retry = await collect(retryConfigs, { signal: options.signal });
  const retrySuccesses = new Map(
    retry.successes.map((success) => [success.config.sourceKey, success]),
  );
  const successes: CollectedFeed[] = [...first.successes];
  for (const config of retryConfigs) {
    const success = retrySuccesses.get(config.sourceKey);
    if (success) successes.push(success);
  }

  return Object.freeze({
    failures: Object.freeze([...retry.failures]),
    successes: Object.freeze(successes),
  });
}
