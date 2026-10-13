CREATE TYPE "public"."evidence_role" AS ENUM('supports', 'contradicts', 'context');--> statement-breakpoint
CREATE TYPE "public"."intelligence_topic" AS ENUM('cloud_engineering', 'software_engineering', 'linux', 'networking', 'devops', 'cybersecurity', 'artificial_intelligence', 'developer_tools', 'open_source', 'technology_communities', 'containers_kubernetes', 'infrastructure_as_code', 'ai_infrastructure', 'engineering_careers');--> statement-breakpoint
CREATE TYPE "public"."item_processing_status" AS ENUM('pending', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."source_item_kind" AS ENUM('article', 'release_note', 'announcement', 'discussion');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('official_feed', 'publisher', 'engineering_organization', 'community');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'in_review', 'verified', 'disputed', 'rejected');--> statement-breakpoint
CREATE TABLE "source_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" varchar(512),
	"original_url" text NOT NULL,
	"canonical_url" varchar(2048) NOT NULL,
	"title" text NOT NULL,
	"kind" "source_item_kind",
	"author" text,
	"summary" text,
	"primary_topic" "intelligence_topic",
	"published_at" timestamp with time zone,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" char(64),
	"processing_status" "item_processing_status" DEFAULT 'pending' NOT NULL,
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"last_error" varchar(2000),
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"verification_notes" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_items_source_external_id_unique" UNIQUE("source_id","external_id"),
	CONSTRAINT "source_items_source_canonical_url_unique" UNIQUE("source_id","canonical_url"),
	CONSTRAINT "source_items_title_not_blank" CHECK (length(btrim("source_items"."title")) > 0),
	CONSTRAINT "source_items_external_id_not_blank" CHECK ("source_items"."external_id" IS NULL OR length(btrim("source_items"."external_id")) > 0),
	CONSTRAINT "source_items_original_url_format" CHECK ("source_items"."original_url" ~ '^https?://'),
	CONSTRAINT "source_items_canonical_url_format" CHECK ("source_items"."canonical_url" ~ '^https?://' AND octet_length("source_items"."canonical_url") <= 2048),
	CONSTRAINT "source_items_content_hash_format" CHECK ("source_items"."content_hash" IS NULL OR "source_items"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "source_items_attempts_nonnegative" CHECK ("source_items"."processing_attempts" >= 0),
	CONSTRAINT "source_items_seen_after_collection" CHECK ("source_items"."last_seen_at" >= "source_items"."collected_at"),
	CONSTRAINT "source_items_verified_details" CHECK ("source_items"."verification_status" <> 'verified' OR ("source_items"."verified_at" IS NOT NULL AND "source_items"."verification_notes" IS NOT NULL AND length(btrim("source_items"."verification_notes")) > 0))
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"name" text NOT NULL,
	"canonical_url" varchar(2048) NOT NULL,
	"kind" "source_kind" NOT NULL,
	"primary_topic" "intelligence_topic",
	"description" text,
	"reliability_score" integer,
	"reliability_notes" text,
	"priority" integer DEFAULT 50 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"ingestion_cursor" text,
	"last_collected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_key_unique" UNIQUE("key"),
	CONSTRAINT "sources_canonical_url_unique" UNIQUE("canonical_url"),
	CONSTRAINT "sources_key_format" CHECK ("sources"."key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "sources_name_not_blank" CHECK (length(btrim("sources"."name")) > 0),
	CONSTRAINT "sources_url_format" CHECK ("sources"."canonical_url" ~ '^https?://' AND octet_length("sources"."canonical_url") <= 2048),
	CONSTRAINT "sources_reliability_range" CHECK ("sources"."reliability_score" IS NULL OR "sources"."reliability_score" BETWEEN 0 AND 100),
	CONSTRAINT "sources_priority_range" CHECK ("sources"."priority" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deduplication_key" varchar(256) NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"primary_topic" "intelligence_topic",
	"occurred_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"verification_notes" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stories_deduplication_key_unique" UNIQUE("deduplication_key"),
	CONSTRAINT "stories_deduplication_key_not_blank" CHECK (length(btrim("stories"."deduplication_key")) > 0),
	CONSTRAINT "stories_title_not_blank" CHECK (length(btrim("stories"."title")) > 0),
	CONSTRAINT "stories_verified_details" CHECK ("stories"."verification_status" <> 'verified' OR ("stories"."verified_at" IS NOT NULL AND "stories"."verification_notes" IS NOT NULL AND length(btrim("stories"."verification_notes")) > 0))
);
--> statement-breakpoint
CREATE TABLE "story_source_items" (
	"story_id" uuid NOT NULL,
	"source_item_id" uuid NOT NULL,
	"role" "evidence_role" DEFAULT 'context' NOT NULL,
	"notes" text,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_source_items_pk" PRIMARY KEY("story_id","source_item_id")
);
--> statement-breakpoint
ALTER TABLE "source_items" ADD CONSTRAINT "source_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_source_items" ADD CONSTRAINT "story_source_items_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_source_items" ADD CONSTRAINT "story_source_items_source_item_id_source_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."source_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_items_source_collected_idx" ON "source_items" USING btree ("source_id","collected_at");--> statement-breakpoint
CREATE INDEX "source_items_processing_retry_idx" ON "source_items" USING btree ("processing_status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "source_items_topic_published_idx" ON "source_items" USING btree ("primary_topic","published_at");--> statement-breakpoint
CREATE INDEX "source_items_content_hash_idx" ON "source_items" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "sources_active_priority_idx" ON "sources" USING btree ("is_active","priority");--> statement-breakpoint
CREATE INDEX "stories_verification_updated_idx" ON "stories" USING btree ("verification_status","updated_at");--> statement-breakpoint
CREATE INDEX "stories_topic_occurred_idx" ON "stories" USING btree ("primary_topic","occurred_at");--> statement-breakpoint
CREATE INDEX "story_source_items_item_idx" ON "story_source_items" USING btree ("source_item_id");