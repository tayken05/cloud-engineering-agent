CREATE TYPE "public"."job_closure_reason" AS ENUM('repeated_absence', 'application_deadline', 'explicit_provider_closure');--> statement-breakpoint
CREATE TABLE "job_discovery_runs" (
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
	"jobs_discovered" integer DEFAULT 0 NOT NULL,
	"jobs_inserted" integer DEFAULT 0 NOT NULL,
	"jobs_updated" integer DEFAULT 0 NOT NULL,
	"jobs_verified" integer DEFAULT 0 NOT NULL,
	"jobs_marked_closed" integer DEFAULT 0 NOT NULL,
	"jobs_pending_verification" integer DEFAULT 0 NOT NULL,
	"jobs_unchanged" integer DEFAULT 0 NOT NULL,
	"failure_code" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_discovery_runs_counts_nonnegative" CHECK (
    "job_discovery_runs"."sources_attempted" >= 0 AND "job_discovery_runs"."sources_succeeded" >= 0 AND "job_discovery_runs"."sources_failed" >= 0 AND
    "job_discovery_runs"."jobs_discovered" >= 0 AND "job_discovery_runs"."jobs_inserted" >= 0 AND "job_discovery_runs"."jobs_updated" >= 0 AND
    "job_discovery_runs"."jobs_verified" >= 0 AND "job_discovery_runs"."jobs_marked_closed" >= 0 AND
    "job_discovery_runs"."jobs_pending_verification" >= 0 AND "job_discovery_runs"."jobs_unchanged" >= 0
  ),
	CONSTRAINT "job_discovery_runs_source_counts_consistent" CHECK (
    "job_discovery_runs"."sources_succeeded" + "job_discovery_runs"."sources_failed" = "job_discovery_runs"."sources_attempted" AND
    cardinality("job_discovery_runs"."processed_source_keys") = "job_discovery_runs"."sources_attempted" AND
    cardinality("job_discovery_runs"."failed_source_keys") = "job_discovery_runs"."sources_failed"
  ),
	CONSTRAINT "job_discovery_runs_lease_state" CHECK (
    ("job_discovery_runs"."status" = 'running' AND "job_discovery_runs"."lease_token" IS NOT NULL AND "job_discovery_runs"."lease_expires_at" IS NOT NULL AND "job_discovery_runs"."finished_at" IS NULL) OR
    ("job_discovery_runs"."status" <> 'running' AND "job_discovery_runs"."lease_token" IS NULL AND "job_discovery_runs"."lease_expires_at" IS NULL AND "job_discovery_runs"."finished_at" IS NOT NULL)
  ),
	CONSTRAINT "job_discovery_runs_finished_after_start" CHECK ("job_discovery_runs"."finished_at" IS NULL OR "job_discovery_runs"."finished_at" >= "job_discovery_runs"."started_at")
);
--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "last_attempted_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "last_successful_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_sources" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "last_checked_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "missing_observation_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "missing_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "closure_reason" "job_closure_reason";--> statement-breakpoint
CREATE UNIQUE INDEX "job_discovery_runs_single_running_idx" ON "job_discovery_runs" USING btree ((true)) WHERE "job_discovery_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "job_discovery_runs_status_finished_idx" ON "job_discovery_runs" USING btree ("status","finished_at");--> statement-breakpoint
CREATE INDEX "job_discovery_runs_started_idx" ON "job_discovery_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "jobs_status_checked_idx" ON "jobs" USING btree ("status","last_checked_at");--> statement-breakpoint
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_failures_nonnegative" CHECK ("job_sources"."consecutive_failures" >= 0);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_checked_after_seen" CHECK ("jobs"."last_checked_at" >= "jobs"."last_seen_at");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_missing_state" CHECK (
    ("jobs"."missing_observation_count" = 0 AND "jobs"."missing_since" IS NULL) OR
    ("jobs"."missing_observation_count" > 0 AND "jobs"."missing_since" IS NOT NULL)
  );--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_missing_count_nonnegative" CHECK ("jobs"."missing_observation_count" >= 0);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_closure_state" CHECK (
    ("jobs"."closed_at" IS NULL AND "jobs"."closure_reason" IS NULL) OR
    ("jobs"."closed_at" IS NOT NULL AND "jobs"."closure_reason" IS NOT NULL AND "jobs"."status" IN ('closed', 'expired'))
  );