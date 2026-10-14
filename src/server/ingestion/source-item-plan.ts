import type { NormalizedFeedItem } from "./feed-parser";

export type ExistingSourceItem = Readonly<{
  author: string | null;
  canonicalUrl: string;
  externalId: string | null;
  id: string;
  primaryTopic: NormalizedFeedItem["primaryTopic"] | null;
  publishedAt: Date | null;
  summary: string | null;
  title: string;
}>;

export type SourceItemUpdate = Readonly<{
  changed: boolean;
  existing: ExistingSourceItem;
  item: NormalizedFeedItem;
}>;

export class SourceItemIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceItemIdentityError";
  }
}

function sameDate(left: Date | null, right: Date | null): boolean {
  return left?.getTime() === right?.getTime();
}

export function planSourceItems(
  existingRows: readonly ExistingSourceItem[],
  incomingItems: readonly NormalizedFeedItem[],
): Readonly<{
  inserts: readonly NormalizedFeedItem[];
  updates: readonly SourceItemUpdate[];
}> {
  const byExternalId = new Map(
    existingRows.filter((row) => row.externalId).map((row) => [row.externalId as string, row]),
  );
  const byCanonicalUrl = new Map(existingRows.map((row) => [row.canonicalUrl, row]));
  const inserts: NormalizedFeedItem[] = [];
  const updates: SourceItemUpdate[] = [];

  for (const item of incomingItems) {
    const idMatch = item.externalId ? byExternalId.get(item.externalId) : undefined;
    const urlMatch = byCanonicalUrl.get(item.canonicalUrl);
    if (idMatch && urlMatch && idMatch.id !== urlMatch.id) {
      throw new SourceItemIdentityError("An external identifier and canonical URL resolve to different records.");
    }
    const existing = idMatch ?? urlMatch;
    if (!existing) {
      inserts.push(item);
      continue;
    }
    if (idMatch && idMatch.canonicalUrl !== item.canonicalUrl) {
      throw new SourceItemIdentityError("An existing external identifier arrived with a different canonical URL.");
    }
    if (urlMatch?.externalId && item.externalId && urlMatch.externalId !== item.externalId) {
      throw new SourceItemIdentityError("An existing canonical URL arrived with a different external identifier.");
    }
    updates.push(Object.freeze({
      changed:
        existing.author !== item.author ||
        (existing.externalId === null && item.externalId !== null) ||
        existing.primaryTopic !== item.primaryTopic ||
        existing.summary !== item.summary ||
        existing.title !== item.title ||
        !sameDate(existing.publishedAt, item.publishedAt),
      existing,
      item,
    }));
  }
  return Object.freeze({ inserts: Object.freeze(inserts), updates: Object.freeze(updates) });
}
