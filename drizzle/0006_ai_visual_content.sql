CREATE TYPE "public"."content_media_origin" AS ENUM('ai_generated', 'owner_upload');--> statement-breakpoint
CREATE TYPE "public"."content_media_path" AS ENUM('text_only', 'text_first', 'image_first');--> statement-breakpoint
ALTER TYPE "public"."ai_generation_kind" ADD VALUE 'image';--> statement-breakpoint
CREATE TABLE "content_media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"draft_id" varchar(128) NOT NULL,
	"generation_run_id" uuid,
	"origin" "content_media_origin" NOT NULL,
	"storage_pathname" varchar(1024) NOT NULL,
	"content_type" varchar(64) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" integer NOT NULL,
	"provider" varchar(64),
	"model" varchar(128),
	"provider_request_id" varchar(128),
	"generation_prompt" varchar(4000),
	"image_description" varchar(2000) NOT NULL,
	"alt_text" varchar(1000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_media_assets_storage_path_unique" UNIQUE("storage_pathname"),
	CONSTRAINT "content_media_assets_run_unique" UNIQUE("generation_run_id"),
	CONSTRAINT "content_media_assets_owner_not_blank" CHECK (length(btrim("content_media_assets"."owner_id")) > 0),
	CONSTRAINT "content_media_assets_dimensions_positive" CHECK ("content_media_assets"."width" > 0 AND "content_media_assets"."height" > 0),
	CONSTRAINT "content_media_assets_size_bounded" CHECK ("content_media_assets"."byte_size" > 0 AND "content_media_assets"."byte_size" <= 15728640),
	CONSTRAINT "content_media_assets_type" CHECK ("content_media_assets"."content_type" IN ('image/png', 'image/jpeg', 'image/webp')),
	CONSTRAINT "content_media_assets_description_not_blank" CHECK (length(btrim("content_media_assets"."image_description")) > 0 AND length(btrim("content_media_assets"."alt_text")) > 0),
	CONSTRAINT "content_media_assets_origin_fields" CHECK (
    ("content_media_assets"."origin" = 'ai_generated' AND "content_media_assets"."generation_run_id" IS NOT NULL AND "content_media_assets"."provider" IS NOT NULL AND "content_media_assets"."model" IS NOT NULL AND "content_media_assets"."generation_prompt" IS NOT NULL) OR
    ("content_media_assets"."origin" = 'owner_upload' AND "content_media_assets"."generation_run_id" IS NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "content_drafts" ADD COLUMN "media_path" "content_media_path" DEFAULT 'text_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_drafts" ADD COLUMN "image_prompt" varchar(4000);--> statement-breakpoint
ALTER TABLE "content_drafts" ADD COLUMN "image_alt_text" varchar(1000);--> statement-breakpoint
ALTER TABLE "content_media_assets" ADD CONSTRAINT "content_media_assets_draft_owner_fk" FOREIGN KEY ("draft_id","owner_id") REFERENCES "public"."content_drafts"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_media_assets" ADD CONSTRAINT "content_media_assets_run_owner_fk" FOREIGN KEY ("generation_run_id","owner_id") REFERENCES "public"."ai_generation_runs"("id","owner_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_media_assets_owner_draft_created_idx" ON "content_media_assets" USING btree ("owner_id","draft_id","created_at");