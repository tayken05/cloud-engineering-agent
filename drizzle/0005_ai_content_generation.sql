CREATE TYPE "public"."ai_generation_kind" AS ENUM('idea_batch', 'draft');--> statement-breakpoint
CREATE TYPE "public"."ai_generation_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_suggestion_status" AS ENUM('proposed', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ai_verification_status" AS ENUM('evidence_backed', 'needs_review');--> statement-breakpoint
CREATE TABLE "ai_content_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"kind" "ai_generation_kind" NOT NULL,
	"ordinal" integer NOT NULL,
	"verification_status" "ai_verification_status" DEFAULT 'needs_review' NOT NULL,
	"payload" jsonb NOT NULL,
	"editorial_status" "ai_suggestion_status" DEFAULT 'proposed' NOT NULL,
	"editorial_feedback" varchar(2000),
	"accepted_idea_id" varchar(128),
	"accepted_draft_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_content_suggestions_run_ordinal_unique" UNIQUE("run_id","ordinal"),
	CONSTRAINT "ai_content_suggestions_ordinal_nonnegative" CHECK ("ai_content_suggestions"."ordinal" >= 0 AND "ai_content_suggestions"."ordinal" < 5),
	CONSTRAINT "ai_content_suggestions_payload_object" CHECK (jsonb_typeof("ai_content_suggestions"."payload") = 'object'),
	CONSTRAINT "ai_content_suggestions_acceptance" CHECK (
    ("ai_content_suggestions"."editorial_status" <> 'accepted' AND "ai_content_suggestions"."accepted_idea_id" IS NULL AND "ai_content_suggestions"."accepted_draft_id" IS NULL) OR
    ("ai_content_suggestions"."editorial_status" = 'accepted' AND num_nonnulls("ai_content_suggestions"."accepted_idea_id", "ai_content_suggestions"."accepted_draft_id") = 1)
  )
);
--> statement-breakpoint
CREATE TABLE "ai_generation_evidence" (
	"run_id" uuid NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"source_item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_generation_evidence_pk" PRIMARY KEY("run_id","source_item_id")
);
--> statement-breakpoint
CREATE TABLE "ai_generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"kind" "ai_generation_kind" NOT NULL,
	"provider" varchar(64) NOT NULL,
	"model" varchar(128) NOT NULL,
	"provider_response_id" varchar(128),
	"status" "ai_generation_status" DEFAULT 'running' NOT NULL,
	"request_fingerprint" char(64) NOT NULL,
	"requested_count" integer DEFAULT 1 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"reserved_cost_microusd" bigint DEFAULT 0 NOT NULL,
	"estimated_cost_microusd" bigint,
	"error_code" varchar(128),
	"lease_expires_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_generation_runs_owner_idempotency_unique" UNIQUE("owner_id","idempotency_key"),
	CONSTRAINT "ai_generation_runs_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "ai_generation_runs_owner_not_blank" CHECK (length(btrim("ai_generation_runs"."owner_id")) > 0),
	CONSTRAINT "ai_generation_runs_idempotency_not_blank" CHECK (length(btrim("ai_generation_runs"."idempotency_key")) > 0),
	CONSTRAINT "ai_generation_runs_provider_not_blank" CHECK (length(btrim("ai_generation_runs"."provider")) > 0),
	CONSTRAINT "ai_generation_runs_model_not_blank" CHECK (length(btrim("ai_generation_runs"."model")) > 0),
	CONSTRAINT "ai_generation_runs_fingerprint_format" CHECK ("ai_generation_runs"."request_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ai_generation_runs_requested_count" CHECK ("ai_generation_runs"."requested_count" BETWEEN 1 AND 5),
	CONSTRAINT "ai_generation_runs_token_counts" CHECK (("ai_generation_runs"."input_tokens" IS NULL OR "ai_generation_runs"."input_tokens" >= 0) AND ("ai_generation_runs"."output_tokens" IS NULL OR "ai_generation_runs"."output_tokens" >= 0)),
	CONSTRAINT "ai_generation_runs_costs_nonnegative" CHECK ("ai_generation_runs"."reserved_cost_microusd" >= 0 AND ("ai_generation_runs"."estimated_cost_microusd" IS NULL OR "ai_generation_runs"."estimated_cost_microusd" >= 0)),
	CONSTRAINT "ai_generation_runs_state" CHECK (
    ("ai_generation_runs"."status" = 'running' AND "ai_generation_runs"."finished_at" IS NULL) OR
    ("ai_generation_runs"."status" <> 'running' AND "ai_generation_runs"."finished_at" IS NOT NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "ai_content_suggestions" ADD CONSTRAINT "ai_content_suggestions_accepted_idea_id_content_ideas_id_fk" FOREIGN KEY ("accepted_idea_id") REFERENCES "public"."content_ideas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_content_suggestions" ADD CONSTRAINT "ai_content_suggestions_accepted_draft_id_content_drafts_id_fk" FOREIGN KEY ("accepted_draft_id") REFERENCES "public"."content_drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_content_suggestions" ADD CONSTRAINT "ai_content_suggestions_run_owner_fk" FOREIGN KEY ("run_id","owner_id") REFERENCES "public"."ai_generation_runs"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generation_evidence" ADD CONSTRAINT "ai_generation_evidence_source_item_id_source_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."source_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generation_evidence" ADD CONSTRAINT "ai_generation_evidence_run_owner_fk" FOREIGN KEY ("run_id","owner_id") REFERENCES "public"."ai_generation_runs"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_content_suggestions_owner_editorial_idx" ON "ai_content_suggestions" USING btree ("owner_id","editorial_status","created_at");--> statement-breakpoint
CREATE INDEX "ai_generation_evidence_source_idx" ON "ai_generation_evidence" USING btree ("source_item_id");--> statement-breakpoint
CREATE INDEX "ai_generation_evidence_owner_run_idx" ON "ai_generation_evidence" USING btree ("owner_id","run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_generation_runs_single_running_owner_idx" ON "ai_generation_runs" USING btree ("owner_id") WHERE "ai_generation_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "ai_generation_runs_owner_started_idx" ON "ai_generation_runs" USING btree ("owner_id","started_at");--> statement-breakpoint
CREATE INDEX "ai_generation_runs_owner_status_idx" ON "ai_generation_runs" USING btree ("owner_id","status","started_at");