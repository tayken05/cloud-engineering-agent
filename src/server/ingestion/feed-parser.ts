import { XMLParser, XMLValidator } from "fast-xml-parser";

import type { FeedSourceConfig } from "./feed-catalog";

export const MAX_FEED_BYTES = 2 * 1024 * 1024;
export const MAX_SUMMARY_LENGTH = 700;

export type NormalizedFeedItem = Readonly<{
  author: string | null;
  canonicalUrl: string;
  externalId: string | null;
  originalUrl: string;
  primaryTopic: FeedSourceConfig["topic"];
  publishedAt: Date | null;
  sourceKey: string;
  summary: string | null;
  title: string;
}>;

export type ParsedFeed = Readonly<{
  format: "atom" | "rss";
  items: readonly NormalizedFeedItem[];
  rejectedItemCount: number;
}>;

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedParseError";
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function asArray(value: unknown): readonly unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function scalarText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = scalarText(entry);
      if (text) return text;
    }
    return undefined;
  }
  const record = asRecord(value);
  return record ? scalarText(record["#text"] ?? record.name) : undefined;
}

function decodeTextEntities(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const parsed = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 0x10ffff) return "";
      try {
        return String.fromCodePoint(parsed);
      } catch {
        return "";
      }
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

export function toPlainText(value: unknown, maxLength: number): string | null {
  const raw = scalarText(value);
  if (!raw) return null;
  const text = decodeTextEntities(
    raw
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC");
  if (!text) return null;
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeExternalId(value: unknown): string | null {
  const id = toPlainText(value, 512);
  return id || null;
}

function normalizeArticleUrl(value: unknown, allowedHosts: readonly string[]): string {
  const raw = scalarText(value)?.trim();
  if (!raw || raw.length > 2048) throw new FeedParseError("An item is missing a bounded article URL.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FeedParseError("An item contains an invalid article URL.");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !allowedHosts.includes(host)
  ) {
    throw new FeedParseError("An item article URL is outside the approved HTTPS host allowlist.");
  }
  url.hash = "";
  return url.toString();
}

function atomLink(value: unknown): unknown {
  const links = asArray(value);
  const alternate = links.find((entry) => {
    const link = asRecord(entry);
    return link && (link["@_rel"] === undefined || link["@_rel"] === "alternate") && link["@_href"];
  });
  return asRecord(alternate)?.["@_href"];
}

function itemDate(value: unknown): Date | null {
  const raw = scalarText(value)?.trim();
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) throw new FeedParseError("An item contains an invalid publication timestamp.");
  return new Date(timestamp);
}

function normalizeItem(
  raw: unknown,
  format: ParsedFeed["format"],
  config: FeedSourceConfig,
): NormalizedFeedItem {
  const item = asRecord(raw);
  if (!item) throw new FeedParseError("A feed entry is not an object.");
  const title = toPlainText(item.title, 500);
  if (!title) throw new FeedParseError("An item is missing a title.");
  const linkValue = format === "atom" ? atomLink(item.link) : item.link;
  const originalUrl = normalizeArticleUrl(linkValue, config.allowedArticleHosts);
  const publishedAt = itemDate(format === "atom" ? (item.published ?? item.updated) : item.pubDate);
  const authorValue = format === "atom" ? item.author : (item["dc:creator"] ?? item.author);
  const summaryValue = format === "atom" ? item.summary : item.description;

  return Object.freeze({
    author: toPlainText(authorValue, 300),
    canonicalUrl: originalUrl,
    externalId: normalizeExternalId(format === "atom" ? item.id : item.guid),
    originalUrl,
    primaryTopic: config.topic,
    publishedAt,
    sourceKey: config.sourceKey,
    summary: toPlainText(summaryValue, MAX_SUMMARY_LENGTH),
    title,
  });
}

export function parseFeedXml(xml: string, config: FeedSourceConfig): ParsedFeed {
  if (Buffer.byteLength(xml, "utf8") > MAX_FEED_BYTES) {
    throw new FeedParseError("The feed exceeds the configured response-size limit.");
  }
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) {
    throw new FeedParseError("Document type and entity declarations are forbidden.");
  }
  const validation = XMLValidator.validate(xml, { allowBooleanAttributes: false });
  if (validation !== true) throw new FeedParseError("The publisher response is not valid XML.");

  let parsed: unknown;
  try {
    parsed = new XMLParser({
      attributeNamePrefix: "@_",
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseTagValue: false,
      processEntities: false,
      trimValues: true,
    }).parse(xml) as unknown;
  } catch {
    throw new FeedParseError("The publisher response could not be parsed safely.");
  }

  const document = asRecord(parsed);
  const channel = asRecord(asRecord(document?.rss)?.channel);
  const atom = asRecord(document?.feed);
  const format = channel ? "rss" : atom ? "atom" : undefined;
  const entries = channel ? asArray(channel.item) : atom ? asArray(atom.entry) : [];
  if (!format || entries.length === 0) throw new FeedParseError("The XML is not a supported non-empty RSS or Atom feed.");

  const items: NormalizedFeedItem[] = [];
  let rejectedItemCount = 0;
  const externalIds = new Set<string>();
  const canonicalUrls = new Set<string>();
  for (const entry of entries.slice(0, config.maxItems)) {
    try {
      const item = normalizeItem(entry, format, config);
      if (
        canonicalUrls.has(item.canonicalUrl) ||
        (item.externalId !== null && externalIds.has(item.externalId))
      ) {
        rejectedItemCount += 1;
        continue;
      }
      canonicalUrls.add(item.canonicalUrl);
      if (item.externalId !== null) externalIds.add(item.externalId);
      items.push(item);
    } catch (error) {
      if (!(error instanceof FeedParseError)) throw error;
      rejectedItemCount += 1;
    }
  }
  if (items.length === 0) throw new FeedParseError("No valid items remained after feed validation.");
  return Object.freeze({ format, items: Object.freeze(items), rejectedItemCount });
}
