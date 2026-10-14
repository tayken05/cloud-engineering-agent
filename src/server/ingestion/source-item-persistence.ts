import "server-only";

import { and, eq, inArray, or } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "../db/schema.ts";
import { sourceItems, sources } from "../db/schema.ts";
import type { FeedCollectionResult } from "./feed-fetcher.ts";
import { planSourceItems } from "./source-item-plan.ts";

type Database = NeonDatabase<typeof schema>;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type PersistenceCounts = Readonly<{
  insertedCount: number;
  unchangedCount: number;
  updatedCount: number;
}>;

export class SourceItemPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceItemPersistenceError";
  }
}

async function selectFeedSources(
  database: Database | DatabaseTransaction,
  sourceKeys: readonly string[],
) {
  return database
    .select({
      id: sources.id,
      isActive: sources.isActive,
      key: sources.key,
      primaryTopic: sources.primaryTopic,
    })
    .from(sources)
    .where(inArray(sources.key, [...sourceKeys]));
}

function assertFeedSources(
  rows: Awaited<ReturnType<typeof selectFeedSources>>,
  collection: FeedCollectionResult,
) {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  for (const result of collection.successes) {
    const source = byKey.get(result.config.sourceKey);
    if (!source || !source.isActive || source.primaryTopic !== result.config.topic) {
      throw new SourceItemPersistenceError(
        "A collected feed does not match an active registered source and topic.",
      );
    }
  }
  return byKey;
}

async function selectExistingItems(
  transaction: DatabaseTransaction,
  sourceId: string,
  items: FeedCollectionResult["successes"][number]["feed"]["items"],
) {
  const externalIds = items.flatMap((item) => item.externalId ? [item.externalId] : []);
  const urls = items.map((item) => item.canonicalUrl);
  const identities = [inArray(sourceItems.canonicalUrl, urls)];
  if (externalIds.length > 0) identities.push(inArray(sourceItems.externalId, externalIds));
  return transaction
    .select({
      author: sourceItems.author,
      canonicalUrl: sourceItems.canonicalUrl,
      externalId: sourceItems.externalId,
      id: sourceItems.id,
      primaryTopic: sourceItems.primaryTopic,
      publishedAt: sourceItems.publishedAt,
      summary: sourceItems.summary,
      title: sourceItems.title,
    })
    .from(sourceItems)
    .where(and(eq(sourceItems.sourceId, sourceId), or(...identities)));
}

export async function persistCollectedFeeds(
  database: Database,
  collection: FeedCollectionResult,
  collectedAt: Date,
  hooks: Readonly<{
    beforeWrite?: (transaction: DatabaseTransaction) => Promise<void>;
    beforeCommit?: (
      transaction: DatabaseTransaction,
      counts: PersistenceCounts,
    ) => Promise<void>;
  }> = {},
): Promise<PersistenceCounts> {
  return database.transaction(async (transaction) => {
    await hooks.beforeWrite?.(transaction);
    const sourceKeys = collection.successes.map((result) => result.config.sourceKey);
    const sourceMap = assertFeedSources(
      await selectFeedSources(transaction, sourceKeys),
      collection,
    );
    let insertedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    for (const result of collection.successes) {
      const source = sourceMap.get(result.config.sourceKey);
      if (!source) {
        throw new SourceItemPersistenceError("A collected feed lost its registered source mapping.");
      }
      const existing = await selectExistingItems(transaction, source.id, result.feed.items);
      const plan = planSourceItems(existing, result.feed.items);
      if (plan.inserts.length > 0) {
        const inserted = await transaction
          .insert(sourceItems)
          .values(plan.inserts.map((item) => ({
            author: item.author,
            canonicalUrl: item.canonicalUrl,
            collectedAt,
            externalId: item.externalId,
            kind: "article" as const,
            lastSeenAt: collectedAt,
            originalUrl: item.originalUrl,
            primaryTopic: item.primaryTopic,
            publishedAt: item.publishedAt,
            sourceId: source.id,
            summary: item.summary,
            title: item.title,
          })))
          .onConflictDoNothing()
          .returning({ id: sourceItems.id });
        insertedCount += inserted.length;
      }
      const unchangedIds = plan.updates
        .filter((update) => !update.changed)
        .map((update) => update.existing.id);
      if (unchangedIds.length > 0) {
        await transaction
          .update(sourceItems)
          .set({ lastSeenAt: collectedAt })
          .where(inArray(sourceItems.id, unchangedIds));
        unchangedCount += unchangedIds.length;
      }
      for (const update of plan.updates.filter((candidate) => candidate.changed)) {
        await transaction
          .update(sourceItems)
          .set({
            author: update.item.author,
            externalId: update.item.externalId ?? update.existing.externalId,
            lastSeenAt: collectedAt,
            primaryTopic: update.item.primaryTopic,
            publishedAt: update.item.publishedAt,
            summary: update.item.summary,
            title: update.item.title,
            updatedAt: collectedAt,
          })
          .where(eq(sourceItems.id, update.existing.id));
        updatedCount += 1;
      }
      const finalRows = await selectExistingItems(transaction, source.id, result.feed.items);
      const finalPlan = planSourceItems(finalRows, result.feed.items);
      if (finalPlan.inserts.length !== 0 || finalRows.length !== result.feed.items.length) {
        throw new SourceItemPersistenceError(
          "The source-item batch did not reach its approved idempotent state.",
        );
      }
      await transaction
        .update(sources)
        .set({ lastCollectedAt: collectedAt, updatedAt: collectedAt })
        .where(eq(sources.id, source.id));
    }

    const counts = Object.freeze({ insertedCount, unchangedCount, updatedCount });
    await hooks.beforeCommit?.(transaction, counts);
    return counts;
  });
}
