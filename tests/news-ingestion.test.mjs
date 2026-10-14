import assert from "node:assert/strict";
import test from "node:test";

import { collectFeeds, fetchFeed } from "../src/server/ingestion/feed-fetcher.ts";
import { FeedParseError, parseFeedXml, toPlainText } from "../src/server/ingestion/feed-parser.ts";
import { planSourceItems, SourceItemIdentityError } from "../src/server/ingestion/source-item-plan.ts";

const config = Object.freeze({
  allowedArticleHosts: ["publisher.example"],
  allowedFeedHosts: ["publisher.example"],
  feedUrl: "https://publisher.example/feed.xml",
  maxItems: 20,
  sourceKey: "publisher",
  topic: "cloud_engineering",
});

const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Updates</title>
<item><title>Safe &amp; useful &lt;update&gt;</title><link>https://publisher.example/posts/one#section</link>
<guid>item-1</guid><pubDate>Tue, 13 Oct 2026 12:00:00 GMT</pubDate>
<dc:creator>A. Engineer</dc:creator><description><![CDATA[<p>A short <strong>technical</strong> summary.</p><script>bad()</script>]]></description></item>
</channel></rss>`;

const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<title>Updates</title><entry><title>Atom update</title><id>tag:publisher.example,2026:2</id>
<link rel="alternate" href="https://publisher.example/posts/two"/><published>2026-10-12T09:30:00Z</published>
<author><name>Platform Team</name></author><summary>Useful details</summary></entry></feed>`;

test("RSS and Atom entries normalize to bounded publisher metadata", () => {
  const rssResult = parseFeedXml(rss, config);
  assert.equal(rssResult.format, "rss");
  assert.equal(rssResult.items.length, 1);
  assert.deepEqual(rssResult.items[0], {
    author: "A. Engineer",
    canonicalUrl: "https://publisher.example/posts/one",
    externalId: "item-1",
    originalUrl: "https://publisher.example/posts/one",
    primaryTopic: "cloud_engineering",
    publishedAt: new Date("2026-10-13T12:00:00.000Z"),
    sourceKey: "publisher",
    summary: "A short technical summary.",
    title: "Safe & useful <update>",
  });

  const atomResult = parseFeedXml(atom, config);
  assert.equal(atomResult.format, "atom");
  assert.equal(atomResult.items[0]?.author, "Platform Team");
  assert.equal(atomResult.items[0]?.externalId, "tag:publisher.example,2026:2");
});

test("malformed XML, declarations, and off-allowlist links fail safely", () => {
  assert.throws(() => parseFeedXml("<rss><channel>", config), FeedParseError);
  assert.throws(
    () => parseFeedXml(`<!DOCTYPE rss [<!ENTITY x "unsafe">]>${rss}`, config),
    /forbidden/,
  );
  assert.throws(
    () => parseFeedXml(rss.replace("publisher.example/posts/one", "attacker.example/item"), config),
    /No valid items/,
  );
  assert.equal(toPlainText("<img src=x onerror=bad()>hello", 100), "hello");
});

test("HTML declarations inside CDATA remain content while XML declarations stay forbidden", () => {
  const withHtmlDoctype = rss.replace(
    "<p>A short <strong>technical</strong> summary.</p><script>bad()</script>",
    '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN"><p>Useful details</p>',
  );
  assert.equal(parseFeedXml(withHtmlDoctype, config).items[0]?.title, "Safe & useful <update>");
  assert.throws(() => parseFeedXml(`<!DOCTYPE rss>${rss}`, config), /forbidden/);
});

test("Linux releases use only feed-provided, release-matched changelog URLs", () => {
  const kernelConfig = {
    ...config,
    allowedArticleHosts: ["cdn.kernel.org"],
    articleLinkPolicy: "linux_kernel_changelog",
    sourceKey: "linux-kernel-archives",
    topic: "linux",
  };
  const kernelFeed = `<?xml version="1.0"?><rss version="2.0"><channel><title>Kernel releases</title>
    <item><title>6.12.3: stable</title><link>https://www.kernel.org/</link>
      <guid>kernel.org,stable,6.12.3,2026-10-13</guid><pubDate>Tue, 13 Oct 2026 12:00:00 GMT</pubDate>
      <description><![CDATA[<a href="https://cdn.kernel.org/pub/linux/kernel/v6.x/ChangeLog-6.12.3">ChangeLog</a>]]></description>
    </item>
    <item><title>7.0-rc1: mainline</title><link>https://www.kernel.org/</link>
      <guid>kernel.org,mainline,7.0-rc1,2026-10-13</guid><pubDate>Tue, 13 Oct 2026 13:00:00 GMT</pubDate>
      <description><![CDATA[No release-specific changelog link.]]></description>
    </item>
  </channel></rss>`;
  const parsed = parseFeedXml(kernelFeed, kernelConfig);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.rejectedItemCount, 1);
  assert.equal(
    parsed.items[0]?.canonicalUrl,
    "https://cdn.kernel.org/pub/linux/kernel/v6.x/ChangeLog-6.12.3",
  );

  const mismatched = kernelFeed.replace("ChangeLog-6.12.3", "ChangeLog-6.12.2");
  assert.throws(() => parseFeedXml(mismatched, kernelConfig), /No valid items/);
});

test("fetching enforces content type, size, and publisher failure isolation", async () => {
  const validFetch = async () => new Response(rss, {
    headers: { "content-type": "application/rss+xml" },
    status: 200,
  });
  const fetched = await fetchFeed(config, { fetchImpl: validFetch });
  assert.equal(fetched.feed.items.length, 1);

  await assert.rejects(
    () => fetchFeed(config, { fetchImpl: async () => new Response("not xml", {
      headers: { "content-type": "text/html" },
    }) }),
    /not an XML feed/,
  );
  await assert.rejects(
    () => fetchFeed(config, { fetchImpl: async () => new Response(rss, {
      headers: {
        "content-length": String(2 * 1024 * 1024 + 1),
        "content-type": "application/xml",
      },
    }) }),
    /response-size limit/,
  );

  const second = { ...config, sourceKey: "unavailable", feedUrl: "https://publisher.example/unavailable.xml" };
  const result = await collectFeeds([config, second], {
    fetchImpl: async (input) => String(input).includes("unavailable")
      ? new Response("unavailable", { status: 503 })
      : validFetch(),
  });
  assert.equal(result.successes.length, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0]?.sourceKey, "unavailable");
});

test("source-item planning inserts once, updates metadata, and detects split identities", () => {
  const item = parseFeedXml(rss, config).items[0];
  assert.ok(item);
  assert.equal(planSourceItems([], [item]).inserts.length, 1);

  const existing = {
    author: item.author,
    canonicalUrl: item.canonicalUrl,
    externalId: item.externalId,
    id: "00000000-0000-0000-0000-000000000001",
    primaryTopic: item.primaryTopic,
    publishedAt: item.publishedAt,
    summary: item.summary,
    title: item.title,
  };
  const repeat = planSourceItems([existing], [item]);
  assert.equal(repeat.inserts.length, 0);
  assert.equal(repeat.updates.length, 1);
  assert.equal(repeat.updates[0]?.changed, false);

  const revised = { ...item, title: "Revised title" };
  assert.equal(planSourceItems([existing], [revised]).updates[0]?.changed, true);

  const conflictingRows = [
    existing,
    {
      ...existing,
      canonicalUrl: "https://publisher.example/posts/different",
      externalId: "item-2",
      id: "00000000-0000-0000-0000-000000000002",
    },
  ];
  assert.throws(
    () => planSourceItems(conflictingRows, [{ ...item, externalId: "item-2" }]),
    SourceItemIdentityError,
  );
});
