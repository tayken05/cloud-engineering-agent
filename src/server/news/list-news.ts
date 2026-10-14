import "server-only";

import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import type { NewsFilters } from "@/features/news/news-filters";
import { createDatabase } from "@/server/db/client";
import { collectionRuns, sourceItems, sources } from "@/server/db/schema";

export const NEWS_QUERY_LIMIT = 100;

export type NewsRecord = Readonly<{
  author: string | null;
  collectedAt: Date;
  id: string;
  originalUrl: string;
  primaryTopic: (typeof sourceItems.primaryTopic.enumValues)[number] | null;
  publishedAt: Date | null;
  sourceKey: string;
  sourceName: string;
  summary: string | null;
  title: string;
}>;

export type NewsSourceOption = Readonly<{
  key: string;
  name: string;
}>;

export type NewsCatalog = Readonly<{
  items: readonly NewsRecord[];
  lastSuccessfulCollectionAt: Date | null;
  sources: readonly NewsSourceOption[];
}>;

export class NewsQueryError extends Error {
  constructor() {
    super("Collected news could not be loaded.");
    this.name = "NewsQueryError";
  }
}

export async function listNews(
  filters: NewsFilters,
  options: Readonly<{ signal?: AbortSignal }> = {},
): Promise<NewsCatalog> {
  const conditions: SQL[] = [];
  if (filters.source) conditions.push(eq(sources.key, filters.source));
  if (filters.topic) conditions.push(eq(sourceItems.primaryTopic, filters.topic));

  try {
    const database = createDatabase(options);
    const [items, publishers, latestRuns] = await Promise.all([
      database
        .select({
          author: sourceItems.author,
          collectedAt: sourceItems.collectedAt,
          id: sourceItems.id,
          originalUrl: sourceItems.originalUrl,
          primaryTopic: sourceItems.primaryTopic,
          publishedAt: sourceItems.publishedAt,
          sourceKey: sources.key,
          sourceName: sources.name,
          summary: sourceItems.summary,
          title: sourceItems.title,
        })
        .from(sourceItems)
        .innerJoin(sources, eq(sourceItems.sourceId, sources.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(sql`coalesce(${sourceItems.publishedAt}, ${sourceItems.collectedAt})`), desc(sourceItems.id))
        .limit(NEWS_QUERY_LIMIT),
      database
        .selectDistinct({ key: sources.key, name: sources.name })
        .from(sourceItems)
        .innerJoin(sources, eq(sourceItems.sourceId, sources.id))
        .orderBy(sources.name),
      database
        .select({ finishedAt: collectionRuns.finishedAt })
        .from(collectionRuns)
        .where(eq(collectionRuns.status, "succeeded"))
        .orderBy(desc(collectionRuns.finishedAt))
        .limit(1),
    ]);
    return Object.freeze({
      items,
      lastSuccessfulCollectionAt: latestRuns[0]?.finishedAt ?? null,
      sources: publishers,
    });
  } catch {
    throw new NewsQueryError();
  }
}
