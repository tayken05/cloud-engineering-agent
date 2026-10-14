import assert from "node:assert/strict";
import test from "node:test";

import {
  parseNewsIngestionCommand,
  validateFeedCatalog,
} from "../scripts/news-ingestion-guard.mjs";
import { VERIFIED_FEEDS } from "../src/server/ingestion/feed-catalog.ts";

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
  assert.equal(VERIFIED_FEEDS.length, 6);
  assert.equal(new Set(VERIFIED_FEEDS.map((feed) => feed.sourceKey)).size, 6);
  assert.equal(new Set(VERIFIED_FEEDS.map((feed) => feed.feedUrl)).size, 6);
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
