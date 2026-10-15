CREATE TYPE "public"."content_audience" AS ENUM('beginner', 'intermediate', 'advanced', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."content_draft_status" AS ENUM('draft', 'ready_for_review');--> statement-breakpoint
CREATE TYPE "public"."content_engagement_style" AS ENUM('teach', 'discuss', 'challenge', 'ask', 'entertain');--> statement-breakpoint
CREATE TYPE "public"."content_format" AS ENUM('historical-first-principles', 'real-world-analogies', 'things-you-probably-didnt-know', 'breaking-technology-updates', 'beginner-friendly-education', 'deep-technical-education', 'practical-tutorials', 'troubleshooting-challenges', 'architecture-discussions', 'ask-grok', 'myths-vs-facts', 'tech-humor-memes', 'polls-interactive-questions', 'engineering-observations', 'careers-opportunities', 'projects-hands-on-challenges', 'technical-comparisons', 'visual-education', 'community-engagement', 'threads-learning-series');--> statement-breakpoint
CREATE TYPE "public"."content_idea_status" AS ENUM('captured', 'approved', 'drafted', 'archived');--> statement-breakpoint
CREATE TYPE "public"."content_visual_accent" AS ENUM('blue', 'cyan', 'violet', 'amber');--> statement-breakpoint
CREATE TYPE "public"."content_visual_aspect" AS ENUM('square', 'landscape');--> statement-breakpoint
CREATE TYPE "public"."content_visual_template" AS ENUM('cloud-architecture', 'network-troubleshooting', 'educational-fact', 'technical-comparison', 'question-answer', 'visual-analogy');--> statement-breakpoint
CREATE TABLE "content_draft_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" varchar(128) NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"draft_version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_draft_revisions_version_unique" UNIQUE("draft_id","draft_version"),
	CONSTRAINT "content_draft_revisions_version_positive" CHECK ("content_draft_revisions"."draft_version" > 0),
	CONSTRAINT "content_draft_revisions_snapshot_object" CHECK (jsonb_typeof("content_draft_revisions"."snapshot") = 'object')
);
--> statement-breakpoint
CREATE TABLE "content_draft_source_items" (
	"draft_id" varchar(128) NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"source_item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_draft_source_items_pk" PRIMARY KEY("draft_id","source_item_id")
);
--> statement-breakpoint
CREATE TABLE "content_drafts" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"idea_id" varchar(128),
	"format_id" "content_format" NOT NULL,
	"title" varchar(300) DEFAULT '' NOT NULL,
	"caption" varchar(4000) DEFAULT '' NOT NULL,
	"explanation" varchar(12000) DEFAULT '' NOT NULL,
	"moderator_notes" varchar(6000) DEFAULT '' NOT NULL,
	"thread_posts" text[] DEFAULT '{}'::text[] NOT NULL,
	"poll_options" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "content_draft_status" DEFAULT 'draft' NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_drafts_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "content_drafts_owner_idea_unique" UNIQUE("owner_id","idea_id"),
	CONSTRAINT "content_drafts_id_format" CHECK ("content_drafts"."id" ~ '^(draft|starter-draft)-[a-z0-9-]+$'),
	CONSTRAINT "content_drafts_owner_not_blank" CHECK (length(btrim("content_drafts"."owner_id")) > 0),
	CONSTRAINT "content_drafts_thread_limit" CHECK (cardinality("content_drafts"."thread_posts") <= 20),
	CONSTRAINT "content_drafts_poll_limit" CHECK (cardinality("content_drafts"."poll_options") <= 4),
	CONSTRAINT "content_drafts_version_positive" CHECK ("content_drafts"."record_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "content_idea_source_items" (
	"idea_id" varchar(128) NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"source_item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_idea_source_items_pk" PRIMARY KEY("idea_id","source_item_id")
);
--> statement-breakpoint
CREATE TABLE "content_ideas" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"subject" varchar(300) NOT NULL,
	"technical_category" "intelligence_topic" DEFAULT 'cloud_engineering' NOT NULL,
	"format_id" "content_format" NOT NULL,
	"audience" "content_audience" NOT NULL,
	"educational_objective" varchar(1000) NOT NULL,
	"engagement_style" "content_engagement_style" NOT NULL,
	"notes" varchar(4000) DEFAULT '' NOT NULL,
	"status" "content_idea_status" DEFAULT 'captured' NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_ideas_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "content_ideas_owner_subject_unique" UNIQUE("owner_id","subject"),
	CONSTRAINT "content_ideas_id_format" CHECK ("content_ideas"."id" ~ '^(idea|starter-idea)-[a-z0-9-]+$'),
	CONSTRAINT "content_ideas_owner_not_blank" CHECK (length(btrim("content_ideas"."owner_id")) > 0),
	CONSTRAINT "content_ideas_subject_not_blank" CHECK (length(btrim("content_ideas"."subject")) > 0),
	CONSTRAINT "content_ideas_objective_not_blank" CHECK (length(btrim("content_ideas"."educational_objective")) > 0),
	CONSTRAINT "content_ideas_version_positive" CHECK ("content_ideas"."record_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "content_visual_specifications" (
	"draft_id" varchar(128) PRIMARY KEY NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"template_id" "content_visual_template" NOT NULL,
	"aspect" "content_visual_aspect" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"accent" "content_visual_accent" NOT NULL,
	"title" varchar(180) DEFAULT '' NOT NULL,
	"subtitle" varchar(280) DEFAULT '' NOT NULL,
	"caption" varchar(240) DEFAULT '' NOT NULL,
	"footer" varchar(120) DEFAULT '' NOT NULL,
	"left_label" varchar(80) DEFAULT '' NOT NULL,
	"right_label" varchar(80) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_visual_specifications_dimensions" CHECK (("content_visual_specifications"."aspect" = 'square' AND "content_visual_specifications"."width" = 1080 AND "content_visual_specifications"."height" = 1080) OR ("content_visual_specifications"."aspect" = 'landscape' AND "content_visual_specifications"."width" = 1600 AND "content_visual_specifications"."height" = 900))
);
--> statement-breakpoint
ALTER TABLE "content_draft_revisions" ADD CONSTRAINT "content_draft_revisions_owner_fk" FOREIGN KEY ("draft_id","owner_id") REFERENCES "public"."content_drafts"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_draft_source_items" ADD CONSTRAINT "content_draft_source_items_source_item_id_source_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."source_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_draft_source_items" ADD CONSTRAINT "content_draft_source_items_owner_fk" FOREIGN KEY ("draft_id","owner_id") REFERENCES "public"."content_drafts"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_idea_owner_fk" FOREIGN KEY ("idea_id","owner_id") REFERENCES "public"."content_ideas"("id","owner_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_idea_source_items" ADD CONSTRAINT "content_idea_source_items_source_item_id_source_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."source_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_idea_source_items" ADD CONSTRAINT "content_idea_source_items_owner_fk" FOREIGN KEY ("idea_id","owner_id") REFERENCES "public"."content_ideas"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_visual_specifications" ADD CONSTRAINT "content_visual_specifications_owner_fk" FOREIGN KEY ("draft_id","owner_id") REFERENCES "public"."content_drafts"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_draft_revisions_owner_draft_idx" ON "content_draft_revisions" USING btree ("owner_id","draft_id","created_at");--> statement-breakpoint
CREATE INDEX "content_draft_source_items_owner_idx" ON "content_draft_source_items" USING btree ("owner_id","draft_id");--> statement-breakpoint
CREATE INDEX "content_draft_source_items_source_idx" ON "content_draft_source_items" USING btree ("source_item_id");--> statement-breakpoint
CREATE INDEX "content_drafts_owner_updated_idx" ON "content_drafts" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "content_drafts_owner_status_idx" ON "content_drafts" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "content_idea_source_items_owner_idx" ON "content_idea_source_items" USING btree ("owner_id","idea_id");--> statement-breakpoint
CREATE INDEX "content_idea_source_items_source_idx" ON "content_idea_source_items" USING btree ("source_item_id");--> statement-breakpoint
CREATE INDEX "content_ideas_owner_updated_idx" ON "content_ideas" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "content_ideas_owner_status_format_idx" ON "content_ideas" USING btree ("owner_id","status","format_id");--> statement-breakpoint
CREATE INDEX "content_visual_specifications_owner_idx" ON "content_visual_specifications" USING btree ("owner_id","updated_at");