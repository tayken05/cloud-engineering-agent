import "server-only";

import { isIP } from "node:net";

import type { FeedSourceConfig } from "./feed-catalog";
import { FeedParseError, MAX_FEED_BYTES, parseFeedXml, type ParsedFeed } from "./feed-parser.ts";

export const FEED_REQUEST_TIMEOUT_MS = 15_000;
export const FEED_CONCURRENCY = 2;
const MAX_REDIRECTS = 2;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type CollectedFeed = Readonly<{
  config: FeedSourceConfig;
  feed: ParsedFeed;
}>;

export type FeedFailure = Readonly<{
  reason: string;
  sourceKey: string;
}>;

export type FeedCollectionResult = Readonly<{
  failures: readonly FeedFailure[];
  successes: readonly CollectedFeed[];
}>;

export class FeedFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedFetchError";
  }
}

function validateFetchUrl(value: string, config: FeedSourceConfig): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new FeedFetchError("The configured feed URL is invalid.");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(host) !== 0 ||
    !config.allowedFeedHosts.includes(host)
  ) {
    throw new FeedFetchError("The feed URL is outside the approved HTTPS host allowlist.");
  }
  return url;
}

async function readBoundedBody(response: Response): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > MAX_FEED_BYTES) {
    throw new FeedFetchError("The feed exceeds the configured response-size limit.");
  }
  if (!response.body) throw new FeedFetchError("The feed response has no body.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_FEED_BYTES) throw new FeedFetchError("The feed exceeds the configured response-size limit.");
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function fetchFeed(
  config: FeedSourceConfig,
  options: Readonly<{ fetchImpl?: FetchLike; signal?: AbortSignal }> = {},
): Promise<CollectedFeed> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeout = AbortSignal.timeout(FEED_REQUEST_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let url = validateFetchUrl(config.feedUrl, config);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: {
          accept: "application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9",
          "user-agent": "CloudEngineeringAgent/0.1 (+https://cloud-engineering-agent.vercel.app)",
        },
        redirect: "manual",
        signal,
      });
    } catch {
      throw new FeedFetchError("The publisher request did not complete.");
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) throw new FeedFetchError("The feed redirect could not be accepted.");
      url = validateFetchUrl(new URL(location, url).toString(), config);
      continue;
    }
    if (!response.ok) throw new FeedFetchError(`The publisher returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!/(?:atom|rss|xml)/.test(contentType)) throw new FeedFetchError("The publisher response is not an XML feed.");
    try {
      return Object.freeze({ config, feed: parseFeedXml(await readBoundedBody(response), config) });
    } catch (error) {
      if (error instanceof FeedFetchError || error instanceof FeedParseError) throw error;
      throw new FeedFetchError("The publisher response could not be read safely.");
    }
  }
  throw new FeedFetchError("The feed redirect limit was exceeded.");
}

export async function collectFeeds(
  configs: readonly FeedSourceConfig[],
  options: Readonly<{
    concurrency?: number;
    fetchImpl?: FetchLike;
    signal?: AbortSignal;
  }> = {},
): Promise<FeedCollectionResult> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? FEED_CONCURRENCY, FEED_CONCURRENCY));
  const successes: CollectedFeed[] = [];
  const failures: FeedFailure[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < configs.length) {
      const config = configs[nextIndex];
      nextIndex += 1;
      if (!config) continue;
      try {
        successes.push(await fetchFeed(config, options));
      } catch (error) {
        const reason = error instanceof FeedFetchError || error instanceof FeedParseError
          ? error.message
          : "The feed failed without exposing provider diagnostics.";
        failures.push(Object.freeze({ reason, sourceKey: config.sourceKey }));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, configs.length) }, () => worker()));
  return Object.freeze({ failures: Object.freeze(failures), successes: Object.freeze(successes) });
}
