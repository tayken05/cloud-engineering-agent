import { relations, sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Pure declarations for Drizzle Kit. Application imports use the server-only index.
export const sourceKind = pgEnum("source_kind", [
  "official_feed", "publisher", "engineering_organization", "community",
]);
export const intelligenceTopic = pgEnum("intelligence_topic", [
  "cloud_engineering", "software_engineering", "linux", "networking", "devops",
  "cybersecurity", "artificial_intelligence", "developer_tools", "open_source",
  "technology_communities", "containers_kubernetes", "infrastructure_as_code",
  "ai_infrastructure", "engineering_careers",
]);
export const verificationStatus = pgEnum("verification_status", [
  "unverified", "in_review", "verified", "disputed", "rejected",
]);
export const itemProcessingStatus = pgEnum("item_processing_status", [
  "pending", "processed", "failed", "ignored",
]);
export const sourceItemKind = pgEnum("source_item_kind", [
  "article", "release_note", "announcement", "discussion",
]);
export const evidenceRole = pgEnum("evidence_role", ["supports", "contradicts", "context"]);

const auditColumns = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Writers must update this explicitly; there is no hidden trigger or ORM hook.
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
const verificationColumns = () => ({
  verificationStatus: verificationStatus("verification_status").default("unverified").notNull(),
  verificationNotes: text("verification_notes"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

export const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 128 }).notNull(),
  name: text("name").notNull(),
  canonicalUrl: varchar("canonical_url", { length: 2048 }).notNull(),
  kind: sourceKind("kind").notNull(),
  primaryTopic: intelligenceTopic("primary_topic"),
  description: text("description"),
  reliabilityScore: integer("reliability_score"),
  reliabilityNotes: text("reliability_notes"),
  priority: integer("priority").default(50).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ingestionCursor: text("ingestion_cursor"),
  lastCollectedAt: timestamp("last_collected_at", { withTimezone: true }),
  ...auditColumns(),
}, (table) => [
  unique("sources_key_unique").on(table.key),
  unique("sources_canonical_url_unique").on(table.canonicalUrl),
  index("sources_active_priority_idx").on(table.isActive, table.priority),
  check("sources_key_format", sql`${table.key} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  check("sources_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  check("sources_url_format", sql`${table.canonicalUrl} ~ '^https?://' AND octet_length(${table.canonicalUrl}) <= 2048`),
  check("sources_reliability_range", sql`${table.reliabilityScore} IS NULL OR ${table.reliabilityScore} BETWEEN 0 AND 100`),
  check("sources_priority_range", sql`${table.priority} BETWEEN 0 AND 100`),
]);

export const sourceItems = pgTable("source_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "restrict" }),
  externalId: varchar("external_id", { length: 512 }),
  originalUrl: text("original_url").notNull(),
  canonicalUrl: varchar("canonical_url", { length: 2048 }).notNull(),
  title: text("title").notNull(),
  kind: sourceItemKind("kind"),
  author: text("author"),
  summary: text("summary"),
  primaryTopic: intelligenceTopic("primary_topic"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  collectedAt: timestamp("collected_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  contentHash: char("content_hash", { length: 64 }),
  processingStatus: itemProcessingStatus("processing_status").default("pending").notNull(),
  processingAttempts: integer("processing_attempts").default(0).notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  lastError: varchar("last_error", { length: 2000 }),
  ...verificationColumns(),
  ...auditColumns(),
}, (table) => [
  unique("source_items_source_external_id_unique").on(table.sourceId, table.externalId),
  unique("source_items_source_canonical_url_unique").on(table.sourceId, table.canonicalUrl),
  index("source_items_source_collected_idx").on(table.sourceId, table.collectedAt),
  index("source_items_processing_retry_idx").on(table.processingStatus, table.nextAttemptAt),
  index("source_items_topic_published_idx").on(table.primaryTopic, table.publishedAt),
  index("source_items_content_hash_idx").on(table.contentHash),
  check("source_items_title_not_blank", sql`length(btrim(${table.title})) > 0`),
  check("source_items_external_id_not_blank", sql`${table.externalId} IS NULL OR length(btrim(${table.externalId})) > 0`),
  check("source_items_original_url_format", sql`${table.originalUrl} ~ '^https?://'`),
  check("source_items_canonical_url_format", sql`${table.canonicalUrl} ~ '^https?://' AND octet_length(${table.canonicalUrl}) <= 2048`),
  check("source_items_content_hash_format", sql`${table.contentHash} IS NULL OR ${table.contentHash} ~ '^[0-9a-f]{64}$'`),
  check("source_items_attempts_nonnegative", sql`${table.processingAttempts} >= 0`),
  check("source_items_seen_after_collection", sql`${table.lastSeenAt} >= ${table.collectedAt}`),
  check("source_items_verified_details", sql`${table.verificationStatus} <> 'verified' OR (${table.verifiedAt} IS NOT NULL AND ${table.verificationNotes} IS NOT NULL AND length(btrim(${table.verificationNotes})) > 0)`),
]);

export const stories = pgTable("stories", {
  id: uuid("id").defaultRandom().primaryKey(),
  deduplicationKey: varchar("deduplication_key", { length: 256 }).notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  primaryTopic: intelligenceTopic("primary_topic"),
  // When the underlying development occurred; not a publisher's publication date.
  occurredAt: timestamp("occurred_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...verificationColumns(),
  ...auditColumns(),
}, (table) => [
  unique("stories_deduplication_key_unique").on(table.deduplicationKey),
  index("stories_verification_updated_idx").on(table.verificationStatus, table.updatedAt),
  index("stories_topic_occurred_idx").on(table.primaryTopic, table.occurredAt),
  check("stories_deduplication_key_not_blank", sql`length(btrim(${table.deduplicationKey})) > 0`),
  check("stories_title_not_blank", sql`length(btrim(${table.title})) > 0`),
  check("stories_verified_details", sql`${table.verificationStatus} <> 'verified' OR (${table.verifiedAt} IS NOT NULL AND ${table.verificationNotes} IS NOT NULL AND length(btrim(${table.verificationNotes})) > 0)`),
]);

export const storySourceItems = pgTable("story_source_items", {
  storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: "restrict" }),
  sourceItemId: uuid("source_item_id").notNull().references(() => sourceItems.id, { onDelete: "restrict" }),
  role: evidenceRole("role").default("context").notNull(),
  notes: text("notes"),
  linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull(),
  ...auditColumns(),
}, (table) => [
  primaryKey({ name: "story_source_items_pk", columns: [table.storyId, table.sourceItemId] }),
  index("story_source_items_item_idx").on(table.sourceItemId),
]);

export const sourcesRelations = relations(sources, ({ many }) => ({ items: many(sourceItems) }));
export const sourceItemsRelations = relations(sourceItems, ({ one, many }) => ({
  source: one(sources, { fields: [sourceItems.sourceId], references: [sources.id] }),
  storyLinks: many(storySourceItems),
}));
export const storiesRelations = relations(stories, ({ many }) => ({ evidence: many(storySourceItems) }));
export const storySourceItemsRelations = relations(storySourceItems, ({ one }) => ({
  story: one(stories, { fields: [storySourceItems.storyId], references: [stories.id] }),
  item: one(sourceItems, { fields: [storySourceItems.sourceItemId], references: [sourceItems.id] }),
}));

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type SourceItem = typeof sourceItems.$inferSelect;
export type NewSourceItem = typeof sourceItems.$inferInsert;
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type StorySourceItem = typeof storySourceItems.$inferSelect;
export type NewStorySourceItem = typeof storySourceItems.$inferInsert;
