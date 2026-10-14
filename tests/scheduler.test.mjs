import assert from "node:assert/strict";
import test from "node:test";

import { authorizeCronRequest } from "../src/server/cron/authorize-cron.ts";
import { validateCollectionDatabaseUrl } from "../src/server/ingestion/collection-store.ts";
import { VERIFIED_FEEDS } from "../src/server/ingestion/feed-catalog.ts";
import { collectFeedsWithRetry, FEED_RETRY_DELAY_MS } from "../src/server/ingestion/feed-retry.ts";
import { runNewsCollection } from "../src/server/ingestion/run-collection.ts";

const secret = "a-secure-test-value-that-is-at-least-thirty-two-characters";

function databaseUrl(endpoint, pooled) {
  return `postgresql://user:password@${endpoint}${pooled ? "-pooler" : ""}.example.neon.tech/neondb?sslmode=require`;
}

test("collection connections require the exact endpoint and requested connection mode", () => {
  const endpoint = "ep-approved";
  assert.equal(validateCollectionDatabaseUrl(databaseUrl(endpoint, true), {
    expectedEndpoint: endpoint,
    mode: "pooled",
  }), databaseUrl(endpoint, true));
  assert.equal(validateCollectionDatabaseUrl(databaseUrl(endpoint, false), {
    expectedEndpoint: endpoint,
    mode: "direct",
  }), databaseUrl(endpoint, false));
  assert.throws(() => validateCollectionDatabaseUrl(databaseUrl("ep-other", false), {
    expectedEndpoint: endpoint,
    mode: "direct",
  }), /unexpected database endpoint/);
  assert.throws(() => validateCollectionDatabaseUrl(databaseUrl(endpoint, true), {
    expectedEndpoint: endpoint,
    mode: "direct",
  }), /direct Neon/);
  assert.throws(() => validateCollectionDatabaseUrl(
    databaseUrl(endpoint, false).replace("sslmode=require", "sslmode=disable"),
    { expectedEndpoint: endpoint, mode: "direct" },
  ), /requires TLS/);
});

test("cron authentication fails closed outside production and for missing or invalid secrets", () => {
  const request = new Request("https://example.test/api/cron/news", {
    headers: { authorization: `Bearer ${secret}` },
  });
  assert.deepEqual(authorizeCronRequest(request, { VERCEL: "1", VERCEL_ENV: "preview", CRON_SECRET: secret }), {
    authorized: false,
    status: 404,
  });
  assert.deepEqual(authorizeCronRequest(request, { VERCEL: "1", VERCEL_ENV: "production" }), {
    authorized: false,
    status: 503,
  });
  assert.deepEqual(authorizeCronRequest(new Request(request.url), {
    VERCEL: "1",
    VERCEL_ENV: "production",
    CRON_SECRET: secret,
  }), { authorized: false, status: 401 });
  assert.deepEqual(authorizeCronRequest(request, {
    VERCEL: "1",
    VERCEL_ENV: "production",
    CRON_SECRET: secret,
  }), { authorized: true });
});

test("publisher failures receive one bounded retry and do not block successful feeds", async () => {
  const configs = VERIFIED_FEEDS.slice(0, 2);
  let calls = 0;
  const delays = [];
  const collected = await collectFeedsWithRetry(configs, {
    collect: async (requested) => {
      calls += 1;
      if (calls === 1) {
        return {
          failures: [{ reason: "temporary", sourceKey: requested[1].sourceKey }],
          successes: [{ config: requested[0], feed: { format: "rss", items: [] } }],
        };
      }
      return {
        failures: [],
        successes: [{ config: requested[0], feed: { format: "rss", items: [] } }],
      };
    },
    delay: async (milliseconds) => { delays.push(milliseconds); },
  });
  assert.equal(calls, 2);
  assert.deepEqual(delays, [FEED_RETRY_DELAY_MS]);
  assert.deepEqual(collected.failures, []);
  assert.deepEqual(collected.successes.map((result) => result.config.sourceKey), configs.map((config) => config.sourceKey));
});

function createStore({ acquired = true } = {}) {
  const calls = { close: 0, fail: 0, finish: 0, persist: 0 };
  return {
    calls,
    store: {
      acquire: async () => acquired
        ? { acquired: true, leaseToken: "00000000-0000-4000-8000-000000000001", runId: "run-1" }
        : { acquired: false, runId: "run-skipped" },
      close: async () => { calls.close += 1; },
      fail: async () => { calls.fail += 1; },
      finishWithoutItems: async () => {
        calls.finish += 1;
        return { insertedCount: 0, unchangedCount: 0, updatedCount: 0 };
      },
      persistAndFinish: async () => {
        calls.persist += 1;
        return { insertedCount: 2, unchangedCount: 3, updatedCount: 1 };
      },
    },
  };
}

test("a collection run records success, partial failure, and an active-lease skip honestly", async () => {
  const successStore = createStore();
  const success = await runNewsCollection({
    collect: async () => ({
      failures: [],
      successes: VERIFIED_FEEDS.map((config) => ({ config, feed: { format: "rss", items: [] } })),
    }),
    store: successStore.store,
    trigger: "scheduled",
  });
  assert.equal(success.status, "succeeded");
  assert.deepEqual({ inserted: success.insertedItems, unchanged: success.unchangedItems, updated: success.updatedItems }, {
    inserted: 2,
    unchanged: 3,
    updated: 1,
  });
  assert.equal(successStore.calls.persist, 1);
  assert.equal(successStore.calls.close, 1);

  const partialStore = createStore();
  const partial = await runNewsCollection({
    collect: async () => ({
      failures: [{ reason: "unavailable", sourceKey: VERIFIED_FEEDS[5].sourceKey }],
      successes: VERIFIED_FEEDS.slice(0, 5).map((config) => ({ config, feed: { format: "rss", items: [] } })),
    }),
    store: partialStore.store,
    trigger: "scheduled",
  });
  assert.equal(partial.status, "partially_succeeded");
  assert.equal(partial.failedSources, 1);

  const skippedStore = createStore({ acquired: false });
  const skipped = await runNewsCollection({
    collect: async () => { throw new Error("must not collect"); },
    store: skippedStore.store,
    trigger: "scheduled",
  });
  assert.equal(skipped.status, "skipped");
  assert.equal(skippedStore.calls.persist, 0);
});

test("unexpected collection failures are recorded and safely rethrown", async () => {
  const tracked = createStore();
  await assert.rejects(() => runNewsCollection({
    collect: async () => { throw new Error("provider detail"); },
    store: tracked.store,
    trigger: "scheduled",
  }), /provider detail/);
  assert.equal(tracked.calls.fail, 1);
  assert.equal(tracked.calls.close, 1);
});
