import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
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
export const collectionRunStatus = pgEnum("collection_run_status", [
  "running", "succeeded", "partially_succeeded", "failed", "skipped",
]);
export const collectionRunTrigger = pgEnum("collection_run_trigger", ["scheduled", "manual"]);
export const jobSourceProvider = pgEnum("job_source_provider", [
  "greenhouse", "lever", "ashby", "employer",
]);
export const jobCategory = pgEnum("job_category", [
  "cloud_engineering", "devops_infrastructure", "devsecops", "networking",
  "cybersecurity", "linux", "site_reliability", "platform_engineering",
  "software_engineering", "ai_engineering",
]);
export const employmentType = pgEnum("employment_type", [
  "full_time", "part_time", "contract", "temporary", "internship",
]);
export const experienceLevel = pgEnum("experience_level", [
  "entry_level", "junior", "mid_level", "senior", "lead", "manager", "executive",
]);
export const workplaceArrangement = pgEnum("workplace_arrangement", [
  "remote", "hybrid", "onsite",
]);
export const jobStatus = pgEnum("job_status", [
  "open", "expired", "closed", "unverified",
]);
export const salaryPayPeriod = pgEnum("salary_pay_period", [
  "hour", "day", "week", "month", "year",
]);

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

export const collectionRuns = pgTable("collection_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  trigger: collectionRunTrigger("trigger").notNull(),
  status: collectionRunStatus("status").default("running").notNull(),
  leaseToken: uuid("lease_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  processedSourceKeys: text("processed_source_keys").array().default(sql`'{}'::text[]`).notNull(),
  failedSourceKeys: text("failed_source_keys").array().default(sql`'{}'::text[]`).notNull(),
  sourcesAttempted: integer("sources_attempted").default(0).notNull(),
  sourcesSucceeded: integer("sources_succeeded").default(0).notNull(),
  sourcesFailed: integer("sources_failed").default(0).notNull(),
  itemsInserted: integer("items_inserted").default(0).notNull(),
  itemsUpdated: integer("items_updated").default(0).notNull(),
  itemsUnchanged: integer("items_unchanged").default(0).notNull(),
  failureCode: varchar("failure_code", { length: 128 }),
  ...auditColumns(),
}, (table) => [
  uniqueIndex("collection_runs_single_running_idx")
    .on(sql`(true)`)
    .where(sql`${table.status} = 'running'`),
  index("collection_runs_status_finished_idx").on(table.status, table.finishedAt),
  index("collection_runs_started_idx").on(table.startedAt),
  check("collection_runs_counts_nonnegative", sql`
    ${table.sourcesAttempted} >= 0 AND ${table.sourcesSucceeded} >= 0 AND
    ${table.sourcesFailed} >= 0 AND ${table.itemsInserted} >= 0 AND
    ${table.itemsUpdated} >= 0 AND ${table.itemsUnchanged} >= 0
  `),
  check("collection_runs_source_counts_consistent", sql`
    ${table.sourcesSucceeded} + ${table.sourcesFailed} = ${table.sourcesAttempted} AND
    cardinality(${table.processedSourceKeys}) = ${table.sourcesAttempted} AND
    cardinality(${table.failedSourceKeys}) = ${table.sourcesFailed}
  `),
  check("collection_runs_lease_state", sql`
    (${table.status} = 'running' AND ${table.leaseToken} IS NOT NULL AND
      ${table.leaseExpiresAt} IS NOT NULL AND ${table.finishedAt} IS NULL) OR
    (${table.status} <> 'running' AND ${table.leaseToken} IS NULL AND
      ${table.leaseExpiresAt} IS NULL AND ${table.finishedAt} IS NOT NULL)
  `),
  check("collection_runs_finished_after_start", sql`
    ${table.finishedAt} IS NULL OR ${table.finishedAt} >= ${table.startedAt}
  `),
]);

export const jobEmployers = pgTable("job_employers", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull(),
  name: text("name").notNull(),
  websiteUrl: varchar("website_url", { length: 2048 }).notNull(),
  verificationUrl: varchar("verification_url", { length: 2048 }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  ...auditColumns(),
}, (table) => [
  unique("job_employers_slug_unique").on(table.slug),
  unique("job_employers_website_url_unique").on(table.websiteUrl),
  check("job_employers_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  check("job_employers_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  check("job_employers_website_url_format", sql`${table.websiteUrl} ~ '^https://'`),
  check("job_employers_verification_url_format", sql`${table.verificationUrl} ~ '^https://'`),
]);

export const jobSources = pgTable("job_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  employerId: uuid("employer_id").notNull().references(() => jobEmployers.id, { onDelete: "restrict" }),
  provider: jobSourceProvider("provider").notNull(),
  externalSourceId: varchar("external_source_id", { length: 256 }).notNull(),
  canonicalUrl: varchar("canonical_url", { length: 2048 }).notNull(),
  verificationUrl: varchar("verification_url", { length: 2048 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull(),
  ...auditColumns(),
}, (table) => [
  unique("job_sources_provider_external_id_unique").on(table.provider, table.externalSourceId),
  unique("job_sources_canonical_url_unique").on(table.canonicalUrl),
  index("job_sources_employer_active_idx").on(table.employerId, table.isActive),
  check("job_sources_external_id_not_blank", sql`length(btrim(${table.externalSourceId})) > 0`),
  check("job_sources_canonical_url_format", sql`${table.canonicalUrl} ~ '^https://'`),
  check("job_sources_verification_url_format", sql`${table.verificationUrl} ~ '^https://'`),
]);

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => jobSources.id, { onDelete: "restrict" }),
  externalId: varchar("external_id", { length: 512 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull(),
  title: text("title").notNull(),
  specialization: text("specialization"),
  category: jobCategory("category").notNull(),
  employmentType: employmentType("employment_type"),
  experienceLevel: experienceLevel("experience_level"),
  workplaceArrangement: workplaceArrangement("workplace_arrangement"),
  countryCode: char("country_code", { length: 2 }),
  countryName: varchar("country_name", { length: 128 }),
  region: text("region"),
  city: text("city"),
  locationText: text("location_text").notNull(),
  remoteCountries: text("remote_countries").array(),
  remoteRestriction: text("remote_restriction"),
  salaryMin: bigint("salary_min", { mode: "number" }),
  salaryMax: bigint("salary_max", { mode: "number" }),
  salaryCurrency: char("salary_currency", { length: 3 }),
  salaryPayPeriod: salaryPayPeriod("salary_pay_period"),
  overview: text("overview").notNull(),
  responsibilities: text("responsibilities").array().default(sql`'{}'::text[]`).notNull(),
  requirements: text("requirements").array().default(sql`'{}'::text[]`).notNull(),
  skills: text("skills").array().default(sql`'{}'::text[]`).notNull(),
  certifications: text("certifications").array().default(sql`'{}'::text[]`).notNull(),
  applicationUrl: varchar("application_url", { length: 2048 }).notNull(),
  sourceListingUrl: varchar("source_listing_url", { length: 2048 }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  collectedAt: timestamp("collected_at", { withTimezone: true }).defaultNow().notNull(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull(),
  applicationDeadline: timestamp("application_deadline", { withTimezone: true }),
  status: jobStatus("status").default("unverified").notNull(),
  providerUpdatedAt: timestamp("provider_updated_at", { withTimezone: true }),
  verificationEvidence: text("verification_evidence").notNull(),
  providerMetadata: jsonb("provider_metadata").$type<Readonly<Record<string, string | boolean | number | null>> | null>(),
  contentHash: char("content_hash", { length: 64 }).notNull(),
  structuredDataEligible: boolean("structured_data_eligible").default(false).notNull(),
  ...auditColumns(),
}, (table) => [
  unique("jobs_source_external_id_unique").on(table.sourceId, table.externalId),
  unique("jobs_slug_unique").on(table.slug),
  unique("jobs_source_listing_url_unique").on(table.sourceListingUrl),
  index("jobs_status_published_idx").on(table.status, table.publishedAt),
  index("jobs_category_status_idx").on(table.category, table.status),
  index("jobs_country_status_idx").on(table.countryCode, table.status),
  index("jobs_workplace_status_idx").on(table.workplaceArrangement, table.status),
  index("jobs_experience_status_idx").on(table.experienceLevel, table.status),
  index("jobs_employment_status_idx").on(table.employmentType, table.status),
  index("jobs_source_verified_idx").on(table.sourceId, table.lastVerifiedAt),
  check("jobs_external_id_not_blank", sql`length(btrim(${table.externalId})) > 0`),
  check("jobs_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  check("jobs_title_not_blank", sql`length(btrim(${table.title})) > 0`),
  check("jobs_location_not_blank", sql`length(btrim(${table.locationText})) > 0`),
  check("jobs_overview_not_blank", sql`length(btrim(${table.overview})) > 0`),
  check("jobs_application_url_format", sql`${table.applicationUrl} ~ '^https://'`),
  check("jobs_source_listing_url_format", sql`${table.sourceListingUrl} ~ '^https://'`),
  check("jobs_country_pair", sql`(${table.countryCode} IS NULL) = (${table.countryName} IS NULL)`),
  check("jobs_country_code_format", sql`${table.countryCode} IS NULL OR ${table.countryCode} ~ '^[A-Z]{2}$'`),
  check("jobs_salary_complete", sql`
    (${table.salaryMin} IS NULL AND ${table.salaryMax} IS NULL AND ${table.salaryCurrency} IS NULL AND ${table.salaryPayPeriod} IS NULL) OR
    ((${table.salaryMin} IS NOT NULL OR ${table.salaryMax} IS NOT NULL) AND ${table.salaryCurrency} ~ '^[A-Z]{3}$' AND ${table.salaryPayPeriod} IS NOT NULL)
  `),
  check("jobs_salary_range", sql`
    (${table.salaryMin} IS NULL OR ${table.salaryMin} >= 0) AND
    (${table.salaryMax} IS NULL OR ${table.salaryMax} >= 0) AND
    (${table.salaryMin} IS NULL OR ${table.salaryMax} IS NULL OR ${table.salaryMax} >= ${table.salaryMin})
  `),
  check("jobs_deadline_after_publication", sql`${table.publishedAt} IS NULL OR ${table.applicationDeadline} IS NULL OR ${table.applicationDeadline} >= ${table.publishedAt}`),
  check("jobs_verified_after_collection", sql`${table.lastVerifiedAt} >= ${table.collectedAt}`),
  check("jobs_verification_evidence_not_blank", sql`length(btrim(${table.verificationEvidence})) > 0`),
  check("jobs_content_hash_format", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
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
export const jobEmployersRelations = relations(jobEmployers, ({ many }) => ({ sources: many(jobSources) }));
export const jobSourcesRelations = relations(jobSources, ({ one, many }) => ({
  employer: one(jobEmployers, { fields: [jobSources.employerId], references: [jobEmployers.id] }),
  jobs: many(jobs),
}));
export const jobsRelations = relations(jobs, ({ one }) => ({
  source: one(jobSources, { fields: [jobs.sourceId], references: [jobSources.id] }),
}));

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type SourceItem = typeof sourceItems.$inferSelect;
export type NewSourceItem = typeof sourceItems.$inferInsert;
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type StorySourceItem = typeof storySourceItems.$inferSelect;
export type NewStorySourceItem = typeof storySourceItems.$inferInsert;
export type CollectionRun = typeof collectionRuns.$inferSelect;
export type NewCollectionRun = typeof collectionRuns.$inferInsert;
export type JobEmployer = typeof jobEmployers.$inferSelect;
export type NewJobEmployer = typeof jobEmployers.$inferInsert;
export type JobSource = typeof jobSources.$inferSelect;
export type NewJobSource = typeof jobSources.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
