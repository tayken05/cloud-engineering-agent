CREATE TYPE "public"."collection_run_status" AS ENUM('running', 'succeeded', 'partially_succeeded', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."collection_run_trigger" AS ENUM('scheduled', 'manual');--> statement-breakpoint
CREATE TABLE "collection_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" "collection_run_trigger" NOT NULL,
	"status" "collection_run_status" DEFAULT 'running' NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"processed_source_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"failed_source_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"sources_attempted" integer DEFAULT 0 NOT NULL,
	"sources_succeeded" integer DEFAULT 0 NOT NULL,
	"sources_failed" integer DEFAULT 0 NOT NULL,
	"items_inserted" integer DEFAULT 0 NOT NULL,
	"items_updated" integer DEFAULT 0 NOT NULL,
	"items_unchanged" integer DEFAULT 0 NOT NULL,
	"failure_code" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_runs_counts_nonnegative" CHECK (
    "collection_runs"."sources_attempted" >= 0 AND "collection_runs"."sources_succeeded" >= 0 AND
    "collection_runs"."sources_failed" >= 0 AND "collection_runs"."items_inserted" >= 0 AND
    "collection_runs"."items_updated" >= 0 AND "collection_runs"."items_unchanged" >= 0
  ),
	CONSTRAINT "collection_runs_source_counts_consistent" CHECK (
    "collection_runs"."sources_succeeded" + "collection_runs"."sources_failed" = "collection_runs"."sources_attempted" AND
    cardinality("collection_runs"."processed_source_keys") = "collection_runs"."sources_attempted" AND
    cardinality("collection_runs"."failed_source_keys") = "collection_runs"."sources_failed"
  ),
	CONSTRAINT "collection_runs_lease_state" CHECK (
    ("collection_runs"."status" = 'running' AND "collection_runs"."lease_token" IS NOT NULL AND
      "collection_runs"."lease_expires_at" IS NOT NULL AND "collection_runs"."finished_at" IS NULL) OR
    ("collection_runs"."status" <> 'running' AND "collection_runs"."lease_token" IS NULL AND
      "collection_runs"."lease_expires_at" IS NULL AND "collection_runs"."finished_at" IS NOT NULL)
  ),
	CONSTRAINT "collection_runs_finished_after_start" CHECK (
    "collection_runs"."finished_at" IS NULL OR "collection_runs"."finished_at" >= "collection_runs"."started_at"
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_runs_single_running_idx" ON "collection_runs" USING btree ((true)) WHERE "collection_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "collection_runs_status_finished_idx" ON "collection_runs" USING btree ("status","finished_at");--> statement-breakpoint
CREATE INDEX "collection_runs_started_idx" ON "collection_runs" USING btree ("started_at");