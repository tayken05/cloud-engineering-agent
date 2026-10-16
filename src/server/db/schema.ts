import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  foreignKey,
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
export const jobClosureReason = pgEnum("job_closure_reason", [
  "repeated_absence", "application_deadline", "explicit_provider_closure",
]);
export const contentFormat = pgEnum("content_format", [
  "historical-first-principles", "real-world-analogies", "things-you-probably-didnt-know",
  "breaking-technology-updates", "beginner-friendly-education", "deep-technical-education",
  "practical-tutorials", "troubleshooting-challenges", "architecture-discussions", "ask-grok",
  "myths-vs-facts", "tech-humor-memes", "polls-interactive-questions", "engineering-observations",
  "careers-opportunities", "projects-hands-on-challenges", "technical-comparisons", "visual-education",
  "community-engagement", "threads-learning-series",
]);
export const contentAudience = pgEnum("content_audience", ["beginner", "intermediate", "advanced", "mixed"]);
export const contentIdeaStatus = pgEnum("content_idea_status", ["captured", "approved", "drafted", "archived"]);
export const contentEngagementStyle = pgEnum("content_engagement_style", ["teach", "discuss", "challenge", "ask", "entertain"]);
export const contentDraftStatus = pgEnum("content_draft_status", ["draft", "ready_for_review", "needs_review", "approved", "rejected"]);
export const contentVisualTemplate = pgEnum("content_visual_template", [
  "cloud-architecture", "network-troubleshooting", "educational-fact", "technical-comparison",
  "question-answer", "visual-analogy",
]);
export const contentVisualAspect = pgEnum("content_visual_aspect", ["square", "landscape"]);
export const contentVisualAccent = pgEnum("content_visual_accent", ["blue", "cyan", "violet", "amber"]);
export const aiGenerationKind = pgEnum("ai_generation_kind", ["idea_batch", "draft", "image"]);
export const aiGenerationStatus = pgEnum("ai_generation_status", ["running", "succeeded", "failed"]);
export const aiSuggestionStatus = pgEnum("ai_suggestion_status", ["proposed", "accepted", "rejected"]);
export const aiVerificationStatus = pgEnum("ai_verification_status", ["evidence_backed", "needs_review"]);
export const contentMediaPath = pgEnum("content_media_path", ["text_only", "text_first", "image_first"]);
export const contentMediaOrigin = pgEnum("content_media_origin", ["ai_generated", "owner_upload"]);

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
  lastAttemptedSyncAt: timestamp("last_attempted_sync_at", { withTimezone: true }),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  ...auditColumns(),
}, (table) => [
  unique("job_sources_provider_external_id_unique").on(table.provider, table.externalSourceId),
  unique("job_sources_canonical_url_unique").on(table.canonicalUrl),
  index("job_sources_employer_active_idx").on(table.employerId, table.isActive),
  check("job_sources_external_id_not_blank", sql`length(btrim(${table.externalSourceId})) > 0`),
  check("job_sources_canonical_url_format", sql`${table.canonicalUrl} ~ '^https://'`),
  check("job_sources_verification_url_format", sql`${table.verificationUrl} ~ '^https://'`),
  check("job_sources_failures_nonnegative", sql`${table.consecutiveFailures} >= 0`),
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
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).defaultNow().notNull(),
  missingObservationCount: integer("missing_observation_count").default(0).notNull(),
  missingSince: timestamp("missing_since", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closureReason: jobClosureReason("closure_reason"),
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
  index("jobs_status_checked_idx").on(table.status, table.lastCheckedAt),
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
  check("jobs_checked_after_seen", sql`${table.lastCheckedAt} >= ${table.lastSeenAt}`),
  check("jobs_missing_state", sql`
    (${table.missingObservationCount} = 0 AND ${table.missingSince} IS NULL) OR
    (${table.missingObservationCount} > 0 AND ${table.missingSince} IS NOT NULL)
  `),
  check("jobs_missing_count_nonnegative", sql`${table.missingObservationCount} >= 0`),
  check("jobs_closure_state", sql`
    (${table.closedAt} IS NULL AND ${table.closureReason} IS NULL) OR
    (${table.closedAt} IS NOT NULL AND ${table.closureReason} IS NOT NULL AND ${table.status} IN ('closed', 'expired'))
  `),
  check("jobs_verification_evidence_not_blank", sql`length(btrim(${table.verificationEvidence})) > 0`),
  check("jobs_content_hash_format", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
]);

export const jobDiscoveryRuns = pgTable("job_discovery_runs", {
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
  jobsDiscovered: integer("jobs_discovered").default(0).notNull(),
  jobsInserted: integer("jobs_inserted").default(0).notNull(),
  jobsUpdated: integer("jobs_updated").default(0).notNull(),
  jobsVerified: integer("jobs_verified").default(0).notNull(),
  jobsMarkedClosed: integer("jobs_marked_closed").default(0).notNull(),
  jobsPendingVerification: integer("jobs_pending_verification").default(0).notNull(),
  jobsUnchanged: integer("jobs_unchanged").default(0).notNull(),
  failureCode: varchar("failure_code", { length: 128 }),
  ...auditColumns(),
}, (table) => [
  uniqueIndex("job_discovery_runs_single_running_idx")
    .on(sql`(true)`)
    .where(sql`${table.status} = 'running'`),
  index("job_discovery_runs_status_finished_idx").on(table.status, table.finishedAt),
  index("job_discovery_runs_started_idx").on(table.startedAt),
  check("job_discovery_runs_counts_nonnegative", sql`
    ${table.sourcesAttempted} >= 0 AND ${table.sourcesSucceeded} >= 0 AND ${table.sourcesFailed} >= 0 AND
    ${table.jobsDiscovered} >= 0 AND ${table.jobsInserted} >= 0 AND ${table.jobsUpdated} >= 0 AND
    ${table.jobsVerified} >= 0 AND ${table.jobsMarkedClosed} >= 0 AND
    ${table.jobsPendingVerification} >= 0 AND ${table.jobsUnchanged} >= 0
  `),
  check("job_discovery_runs_source_counts_consistent", sql`
    ${table.sourcesSucceeded} + ${table.sourcesFailed} = ${table.sourcesAttempted} AND
    cardinality(${table.processedSourceKeys}) = ${table.sourcesAttempted} AND
    cardinality(${table.failedSourceKeys}) = ${table.sourcesFailed}
  `),
  check("job_discovery_runs_lease_state", sql`
    (${table.status} = 'running' AND ${table.leaseToken} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL AND ${table.finishedAt} IS NULL) OR
    (${table.status} <> 'running' AND ${table.leaseToken} IS NULL AND ${table.leaseExpiresAt} IS NULL AND ${table.finishedAt} IS NOT NULL)
  `),
  check("job_discovery_runs_finished_after_start", sql`${table.finishedAt} IS NULL OR ${table.finishedAt} >= ${table.startedAt}`),
]);

export const contentIdeas = pgTable("content_ideas", {
  id: varchar("id", { length: 128 }).primaryKey(),
  ownerId: varchar("owner_id", { length: 128 }).notNull(),
  subject: varchar("subject", { length: 300 }).notNull(),
  technicalCategory: intelligenceTopic("technical_category").default("cloud_engineering").notNull(),
  formatId: contentFormat("format_id").notNull(),
  audience: contentAudience("audience").notNull(),
  educationalObjective: varchar("educational_objective", { length: 1000 }).notNull(),
  engagementStyle: contentEngagementStyle("engagement_style").notNull(),
  notes: varchar("notes", { length: 4000 }).default("").notNull(),
  status: contentIdeaStatus("status").default("captured").notNull(),
  recordVersion: integer("record_version").default(1).notNull(),
  ...auditColumns(),
}, (table) => [
  unique("content_ideas_id_owner_unique").on(table.id, table.ownerId),
  unique("content_ideas_owner_subject_unique").on(table.ownerId, table.subject),
  index("content_ideas_owner_updated_idx").on(table.ownerId, table.updatedAt),
  index("content_ideas_owner_status_format_idx").on(table.ownerId, table.status, table.formatId),
  check("content_ideas_id_format", sql`${table.id} ~ '^(idea|starter-idea)-[a-z0-9-]+$'`),
  check("content_ideas_owner_not_blank", sql`length(btrim(${table.ownerId})) > 0`),
  check("content_ideas_subject_not_blank", sql`length(btrim(${table.subject})) > 0`),
  check("content_ideas_objective_not_blank", sql`length(btrim(${table.educationalObjective})) > 0`),
  check("content_ideas_version_positive", sql`${table.recordVersion} > 0`),
]);

export const contentIdeaSourceItems = pgTable("content_idea_source_items", {
  ideaId: varchar("idea_id", { length: 128 }).notNull(),
  ownerId: varchar("owner_id", { length: 128 }).notNull(),
  sourceItemId: uuid("source_item_id").notNull().references(() => sourceItems.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ name: "content_idea_source_items_pk", columns: [table.ideaId, table.sourceItemId] }),
  foreignKey({ name: "content_idea_source_items_owner_fk", columns: [table.ideaId, table.ownerId], foreignColumns: [contentIdeas.id, contentIdeas.ownerId] }).onDelete("cascade"),
  index("content_idea_source_items_owner_idx").on(table.ownerId, table.ideaId),
  index("content_idea_source_items_source_idx").on(table.sourceItemId),
]);

export const contentDrafts = pgTable("content_drafts", {
  id: varchar("id", { length: 128 }).primaryKey(),
  ownerId: varchar("owner_id", { length: 128 }).notNull(),
  ideaId: varchar("idea_id", { length: 128 }),
  formatId: contentFormat("format_id").notNull(),
  title: varchar("title", { length: 300 }).default("").notNull(),
  caption: varchar("caption", { length: 4000 }).default("").notNull(),
  explanation: varchar("explanation", { length: 12000 }).default("").notNull(),
  moderatorNotes: varchar("moderator_notes", { length: 6000 }).default("").notNull(),
  threadPosts: text("thread_posts").array().default(sql`'{}'::text[]`).notNull(),
  pollOptions: text("poll_options").array().default(sql`'{}'::text[]`).notNull(),
  mediaPath: contentMediaPath("media_path").default("text_only").notNull(),
  imagePrompt: varchar("image_prompt", { length: 4000 }),
  imageAltText: varchar("image_alt_text", { length: 1000 }),
  status: contentDraftStatus("status").default("draft").notNull(),
  recordVersion: integer("record_version").default(1).notNull(),
  ...auditColumns(),
}, (table) => [
  unique("content_drafts_id_owner_unique").on(table.id, table.ownerId),
  unique("content_drafts_owner_idea_unique").on(table.ownerId, table.ideaId),
  foreignKey({ name: "content_drafts_idea_owner_fk", columns: [table.ideaId, table.ownerId], foreignColumns: [contentIdeas.id, contentIdeas.ownerId] }).onDelete("restrict"),
  index("content_drafts_owner_updated_idx").on(table.ownerId, table.updatedAt),
  index("content_drafts_owner_status_idx").on(table.ownerId, table.status),
  check("content_drafts_id_format", sql`${table.id} ~ '^(draft|starter-draft)-[a-z0-9-]+$'`),
  check("content_drafts_owner_not_blank", sql`length(btrim(${table.ownerId})) > 0`),
  check("content_drafts_thread_limit", sql`cardinality(${table.threadPosts}) <= 20`),
  check("content_drafts_poll_limit", sql`cardinality(${table.pollOptions}) <= 4`),
  check("content_drafts_version_positive", sql`${table.recordVersion} > 0`),
]);

export const contentDraftSourceItems = pgTable("content_draft_source_items", {
  draftId: varchar("draft_id", { length: 128 }).notNull(),
  ownerId: varchar("owner_id", { length: 128 }).notNull(),
  sourceItemId: uuid("source_item_id").notNull().references(() => sourceItems.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ name: "content_draft_source_items_pk", columns: [table.draftId, table.sourceItemId] }),
  foreignKey({ name: "content_draft_source_items_owner_fk", columns: [table.draftId, table.ownerId], foreignColumns: [contentDrafts.id, contentDrafts.ownerId] }).onDelete("cascade"),
  index("content_draft_source_items_owner_idx").on(table.ownerId, table.draftId),
  index("content_draft_source_items_source_idx").on(table.sourceItemId),
]);

export const contentDraftRevisions = pgTable("content_draft_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  draftId: varchar("draft_id", { length: 128 }).notNull(),
  ownerId: varchar("owner_id", { length: 128 }).notNull(),
  draftVersion: integer("draft_version").notNull(),
  snapshot: jsonb("snapshot").$type<Readonly<Record<string, unknown>>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "content_draft_revisions_owner_fk", columns: [table.draftId, table.ownerId], foreignColumns: [contentDrafts.id, contentDrafts.ownerId] }).onDelete("cascade"),
  unique("content_draft_revisions_version_unique").on(table.draftId, table.draftVersion),
  index("content_draft_revisions_owner_draft_idx").on(table.ownerId, table.draftId, table.createdAt),
  check("content_draft_revisions_version_positive", sql`${table.draftVersion} > 0`),
  check("content_draft_revisions_snapshot_object", sql`jsonb_typeof(${table.snapshot}) = 'object'`),
]);

export const contentVisualSpecifications = pgTable("content_visual_specifications", {
  draftId: varchar("draft_id", { length: 128 }).primaryKey(),
  ownerId: varchar("owner_id", { length: 128 }).notNull(),
  templateId: contentVisualTemplate("template_id").notNull(),
  aspect: contentVisualAspect("aspect").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  accent: contentVisualAccent("accent").notNull(),
  title: varchar("title", { length: 180 }).default("").notNull(),
  subtitle: varchar("subtitle", { length: 280 }).default("").notNull(),
  caption: varchar("caption", { length: 240 }).default("").notNull(),
  footer: varchar("footer", { length: 120 }).default("").notNull(),
  leftLabel: varchar("left_label", { length: 80 }).default("").notNull(),
  rightLabel: varchar("right_label", { length: 80 }).default("").notNull(),
  ...auditColumns(),
}, (table) => [
  foreignKey({ name: "content_visual_specifications_owner_fk", columns: [table.draftId, table.ownerId], foreignColumns: [contentDrafts.id, contentDrafts.ownerId] }).onDelete("cascade"),
  index("content_visual_specifications_owner_idx").on(table.ownerId, table.updatedAt),
  check("content_visual_specifications_dimensions", sql`(${table.aspect} = 'square' AND ${table.width} = 1080 AND ${table.height} = 1080) OR (${table.aspect} = 'landscape' AND ${table.width} = 1600 AND ${table.height} = 900)`),
]);

export const aiGenerationRuns = pgTable("ai_generation_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: varchar("owner_id", { length: 128 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  kind: aiGenerationKind("kind").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  providerResponseId: varchar("provider_response_id", { length: 128 }),
  status: aiGenerationStatus("status").default("running").notNull(),
  requestFingerprint: char("request_fingerprint", { length: 64 }).notNull(),
  requestedCount: integer("requested_count").default(1).notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  reservedCostMicrousd: bigint("reserved_cost_microusd", { mode: "number" }).default(0).notNull(),
  estimatedCostMicrousd: bigint("estimated_cost_microusd", { mode: "number" }),
  errorCode: varchar("error_code", { length: 128 }),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ...auditColumns(),
}, (table) => [
  unique("ai_generation_runs_owner_idempotency_unique").on(table.ownerId, table.idempotencyKey),
  unique("ai_generation_runs_id_owner_unique").on(table.id, table.ownerId),
  uniqueIndex("ai_generation_runs_single_running_owner_idx").on(table.ownerId).where(sql`${table.status} = 'running'`),
  index("ai_generation_runs_owner_started_idx").on(table.ownerId, table.startedAt),
  index("ai_generation_runs_owner_status_idx").on(table.ownerId, table.status, table.startedAt),
  check("ai_generation_runs_owner_not_blank", sql`length(btrim(${table.ownerId})) > 0`),
  check("ai_generation_runs_idempotency_not_blank", sql`length(btrim(${table.idempotencyKey})) > 0`),
  check("ai_generation_runs_provider_not_blank", sql`length(btrim(${table.provider})) > 0`),
  check("ai_generation_runs_model_not_blank", sql`length(btrim(${table.model})) > 0`),
  check("ai_generation_runs_fingerprint_format", sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`),
  check("ai_generation_runs_requested_count", sql`${table.requestedCount} BETWEEN 1 AND 5`),
  check("ai_generation_runs_token_counts", sql`(${table.inputTokens} IS NULL OR ${table.inputTokens} >= 0) AND (${table.outputTokens} IS NULL OR ${table.outputTokens} >= 0)`),
  check("ai_generation_runs_costs_nonnegative", sql`${table.reservedCostMicrousd} >= 0 AND (${table.estimatedCostMicrousd} IS NULL OR ${table.estimatedCostMicrousd} >= 0)`),
  check("ai_generation_runs_state", sql`
    (${table.status} = 'running' AND ${table.finishedAt} IS NULL) OR
    (${table.status} <> 'running' AND ${table.finishedAt} IS NOT NULL)
  `),
]);

export const aiContentSuggestions = pgTable("ai_content_suggestions", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").notNull(),
  ownerId: varchar("owner_id", { length: 128 }).notNull(),
  kind: aiGenerationKind("kind").notNull(),
  ordinal: integer("ordinal").notNull(),
  verificationStatus: aiVerificationStatus("verification_status").default("needs_review").notNull(),
  payload: jsonb("payload").$type<Readonly<Record<string, unknown>>>().notNull(),
  editorialStatus: aiSuggestionStatus("editorial_status").default("proposed").notNull(),
  editorialFeedback: varchar("editorial_feedback", { length: 2000 }),
  acceptedIdeaId: varchar("accepted_idea_id", { length: 128 }).references(() => contentIdeas.id, { onDelete: "restrict" }),
  acceptedDraftId: varchar("accepted_draft_id", { length: 128 }).references(() => contentDrafts.id, { onDelete: "restrict" }),
  ...auditColumns(),
}, (table) => [
  foreignKey({ name: "ai_content_suggestions_run_owner_fk", columns: [table.runId, table.ownerId], foreignColumns: [aiGenerationRuns.id, aiGenerationRuns.ownerId] }).onDelete("cascade"),
  unique("ai_content_suggestions_run_ordinal_unique").on(table.runId, table.ordinal),
  index("ai_content_suggestions_owner_editorial_idx").on(table.ownerId, table.editorialStatus, table.createdAt),
  check("ai_content_suggestions_ordinal_nonnegative", sql`${table.ordinal} >= 0 AND ${table.ordinal} < 5`),
  check("ai_content_suggestions_payload_object", sql`jsonb_typeof(${table.payload}) = 'object'`),
  check("ai_content_suggestions_acceptance", sql`
    (${table.editorialStatus} <> 'accepted' AND ${table.acceptedIdeaId} IS NULL AND ${table.acceptedDraftId} IS NULL) OR
    (${table.editorialStatus} = 'accepted' AND num_nonnulls(${table.acceptedIdeaId}, ${table.acceptedDraftId}) = 1)
  `),
]);

export const aiGenerationEvidence = pgTable("ai_generation_evidence", {
  runId: uuid("run_id").notNull(),
  ownerId: varchar("owner_id", { length: 128 }).notNull(),
  sourceItemId: uuid("source_item_id").notNull().references(() => sourceItems.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ name: "ai_generation_evidence_pk", columns: [table.runId, table.sourceItemId] }),
  foreignKey({ name: "ai_generation_evidence_run_owner_fk", columns: [table.runId, table.ownerId], foreignColumns: [aiGenerationRuns.id, aiGenerationRuns.ownerId] }).onDelete("cascade"),
  index("ai_generation_evidence_source_idx").on(table.sourceItemId),
  index("ai_generation_evidence_owner_run_idx").on(table.ownerId, table.runId),
]);

export const contentMediaAssets = pgTable("content_media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: varchar("owner_id", { length: 128 }).notNull(),
  draftId: varchar("draft_id", { length: 128 }).notNull(),
  generationRunId: uuid("generation_run_id"),
  origin: contentMediaOrigin("origin").notNull(),
  storagePathname: varchar("storage_pathname", { length: 1024 }).notNull(),
  contentType: varchar("content_type", { length: 64 }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  byteSize: integer("byte_size").notNull(),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 128 }),
  providerRequestId: varchar("provider_request_id", { length: 128 }),
  generationPrompt: varchar("generation_prompt", { length: 4000 }),
  imageDescription: varchar("image_description", { length: 2000 }).notNull(),
  altText: varchar("alt_text", { length: 1000 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "content_media_assets_draft_owner_fk", columns: [table.draftId, table.ownerId], foreignColumns: [contentDrafts.id, contentDrafts.ownerId] }).onDelete("cascade"),
  foreignKey({ name: "content_media_assets_run_owner_fk", columns: [table.generationRunId, table.ownerId], foreignColumns: [aiGenerationRuns.id, aiGenerationRuns.ownerId] }).onDelete("restrict"),
  unique("content_media_assets_storage_path_unique").on(table.storagePathname),
  unique("content_media_assets_run_unique").on(table.generationRunId),
  index("content_media_assets_owner_draft_created_idx").on(table.ownerId, table.draftId, table.createdAt),
  check("content_media_assets_owner_not_blank", sql`length(btrim(${table.ownerId})) > 0`),
  check("content_media_assets_dimensions_positive", sql`${table.width} > 0 AND ${table.height} > 0`),
  check("content_media_assets_size_bounded", sql`${table.byteSize} > 0 AND ${table.byteSize} <= 15728640`),
  check("content_media_assets_type", sql`${table.contentType} IN ('image/png', 'image/jpeg', 'image/webp')`),
  check("content_media_assets_description_not_blank", sql`length(btrim(${table.imageDescription})) > 0 AND length(btrim(${table.altText})) > 0`),
  check("content_media_assets_origin_fields", sql`
    (${table.origin} = 'ai_generated' AND ${table.generationRunId} IS NOT NULL AND ${table.provider} IS NOT NULL AND ${table.model} IS NOT NULL AND ${table.generationPrompt} IS NOT NULL) OR
    (${table.origin} = 'owner_upload' AND ${table.generationRunId} IS NULL)
  `),
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
export const contentIdeasRelations = relations(contentIdeas, ({ many }) => ({ evidence: many(contentIdeaSourceItems), drafts: many(contentDrafts) }));
export const contentIdeaSourceItemsRelations = relations(contentIdeaSourceItems, ({ one }) => ({
  idea: one(contentIdeas, { fields: [contentIdeaSourceItems.ideaId], references: [contentIdeas.id] }),
  sourceItem: one(sourceItems, { fields: [contentIdeaSourceItems.sourceItemId], references: [sourceItems.id] }),
}));
export const contentDraftsRelations = relations(contentDrafts, ({ one, many }) => ({
  idea: one(contentIdeas, { fields: [contentDrafts.ideaId], references: [contentIdeas.id] }),
  evidence: many(contentDraftSourceItems), media: many(contentMediaAssets), revisions: many(contentDraftRevisions), visual: one(contentVisualSpecifications),
}));
export const aiGenerationRunsRelations = relations(aiGenerationRuns, ({ many }) => ({
  evidence: many(aiGenerationEvidence), media: many(contentMediaAssets), suggestions: many(aiContentSuggestions),
}));
export const aiContentSuggestionsRelations = relations(aiContentSuggestions, ({ one }) => ({
  run: one(aiGenerationRuns, { fields: [aiContentSuggestions.runId], references: [aiGenerationRuns.id] }),
  acceptedIdea: one(contentIdeas, { fields: [aiContentSuggestions.acceptedIdeaId], references: [contentIdeas.id] }),
  acceptedDraft: one(contentDrafts, { fields: [aiContentSuggestions.acceptedDraftId], references: [contentDrafts.id] }),
}));
export const aiGenerationEvidenceRelations = relations(aiGenerationEvidence, ({ one }) => ({
  run: one(aiGenerationRuns, { fields: [aiGenerationEvidence.runId], references: [aiGenerationRuns.id] }),
  sourceItem: one(sourceItems, { fields: [aiGenerationEvidence.sourceItemId], references: [sourceItems.id] }),
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
export type JobDiscoveryRun = typeof jobDiscoveryRuns.$inferSelect;
export type NewJobDiscoveryRun = typeof jobDiscoveryRuns.$inferInsert;
export type ContentIdeaRow = typeof contentIdeas.$inferSelect;
export type NewContentIdeaRow = typeof contentIdeas.$inferInsert;
export type ContentDraftRow = typeof contentDrafts.$inferSelect;
export type NewContentDraftRow = typeof contentDrafts.$inferInsert;
export type AiGenerationRunRow = typeof aiGenerationRuns.$inferSelect;
export type AiContentSuggestionRow = typeof aiContentSuggestions.$inferSelect;
export type ContentMediaAssetRow = typeof contentMediaAssets.$inferSelect;
