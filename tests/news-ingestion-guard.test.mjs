import assert from "node:assert/strict";
import test from "node:test";

import {
  newsIngestionConfig,
  parseNewsIngestionCommand,
  validateFeedCatalog,
} from "../scripts/news-ingestion-guard.mjs";
import { VERIFIED_FEEDS } from "../src/server/ingestion/feed-catalog.ts";
import { FEED_CONCURRENCY, FEED_REQUEST_TIMEOUT_MS } from "../src/server/ingestion/feed-fetcher.ts";
import { FEED_RETRY_DELAY_MS } from "../src/server/ingestion/feed-retry.ts";

test("news ingestion requires an explicit environment and mode", () => {
  assert.deepEqual(parseNewsIngestionCommand(["--development", "--preflight"]), {
    environment: "development",
    mode: "preflight",
  });
  assert.deepEqual(parseNewsIngestionCommand(["--production", "--execute"]), {
    environment: "production",
    mode: "execute",
  });
  assert.throws(() => parseNewsIngestionCommand(["--production"]), /Choose an environment/);
});

test("the reviewed feed catalog is bounded, unique, and HTTPS-only", () => {
  assert.equal(validateFeedCatalog(VERIFIED_FEEDS), VERIFIED_FEEDS);
  assert.equal(VERIFIED_FEEDS.length, 12);
  assert.equal(new Set(VERIFIED_FEEDS.map((feed) => feed.sourceKey)).size, 12);
  assert.equal(new Set(VERIFIED_FEEDS.map((feed) => feed.feedUrl)).size, 12);
  assert.ok(
    VERIFIED_FEEDS.reduce((total, feed) => total + feed.maxItems, 0) <=
      newsIngestionConfig.maximumTotalItems,
  );

  const worstCaseNetworkWindow =
    Math.ceil(VERIFIED_FEEDS.length / FEED_CONCURRENCY) * FEED_REQUEST_TIMEOUT_MS * 2 +
    FEED_RETRY_DELAY_MS;
  assert.ok(worstCaseNetworkWindow < 225_000);
  for (const feed of VERIFIED_FEEDS) {
    assert.equal(new URL(feed.feedUrl).protocol, "https:");
    assert.ok(feed.maxItems <= 20);
  }
});

test("feed catalog validation rejects duplicate and unapproved endpoints", () => {
  const duplicate = VERIFIED_FEEDS.map((feed, index) => index === 1
    ? {
        ...feed,
        allowedFeedHosts: VERIFIED_FEEDS[0].allowedFeedHosts,
        feedUrl: VERIFIED_FEEDS[0].feedUrl,
      }
    : feed);
  assert.throws(() => validateFeedCatalog(duplicate), /duplicate or unsafe/);

  const insecure = VERIFIED_FEEDS.map((feed, index) => index === 0
    ? { ...feed, feedUrl: "http://aws.amazon.com/feed/" }
    : feed);
  assert.throws(() => validateFeedCatalog(insecure), /credential-free HTTPS/);
});
