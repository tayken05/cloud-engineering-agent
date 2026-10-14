CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'temporary', 'internship');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('entry_level', 'junior', 'mid_level', 'senior', 'lead', 'manager', 'executive');--> statement-breakpoint
CREATE TYPE "public"."job_category" AS ENUM('cloud_engineering', 'devops_infrastructure', 'devsecops', 'networking', 'cybersecurity', 'linux', 'site_reliability', 'platform_engineering', 'software_engineering', 'ai_engineering');--> statement-breakpoint
CREATE TYPE "public"."job_source_provider" AS ENUM('greenhouse', 'lever', 'ashby', 'employer');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('open', 'expired', 'closed', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."salary_pay_period" AS ENUM('hour', 'day', 'week', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."workplace_arrangement" AS ENUM('remote', 'hybrid', 'onsite');--> statement-breakpoint
CREATE TABLE "job_employers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(128) NOT NULL,
	"name" text NOT NULL,
	"website_url" varchar(2048) NOT NULL,
	"verification_url" varchar(2048) NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_employers_slug_unique" UNIQUE("slug"),
	CONSTRAINT "job_employers_website_url_unique" UNIQUE("website_url"),
	CONSTRAINT "job_employers_slug_format" CHECK ("job_employers"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "job_employers_name_not_blank" CHECK (length(btrim("job_employers"."name")) > 0),
	CONSTRAINT "job_employers_website_url_format" CHECK ("job_employers"."website_url" ~ '^https://'),
	CONSTRAINT "job_employers_verification_url_format" CHECK ("job_employers"."verification_url" ~ '^https://')
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"provider" "job_source_provider" NOT NULL,
	"external_source_id" varchar(256) NOT NULL,
	"canonical_url" varchar(2048) NOT NULL,
	"verification_url" varchar(2048) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_sources_provider_external_id_unique" UNIQUE("provider","external_source_id"),
	CONSTRAINT "job_sources_canonical_url_unique" UNIQUE("canonical_url"),
	CONSTRAINT "job_sources_external_id_not_blank" CHECK (length(btrim("job_sources"."external_source_id")) > 0),
	CONSTRAINT "job_sources_canonical_url_format" CHECK ("job_sources"."canonical_url" ~ '^https://'),
	CONSTRAINT "job_sources_verification_url_format" CHECK ("job_sources"."verification_url" ~ '^https://')
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" varchar(512) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"title" text NOT NULL,
	"specialization" text,
	"category" "job_category" NOT NULL,
	"employment_type" "employment_type",
	"experience_level" "experience_level",
	"workplace_arrangement" "workplace_arrangement",
	"country_code" char(2),
	"country_name" varchar(128),
	"region" text,
	"city" text,
	"location_text" text NOT NULL,
	"remote_countries" text[],
	"remote_restriction" text,
	"salary_min" bigint,
	"salary_max" bigint,
	"salary_currency" char(3),
	"salary_pay_period" "salary_pay_period",
	"overview" text NOT NULL,
	"responsibilities" text[] DEFAULT '{}'::text[] NOT NULL,
	"requirements" text[] DEFAULT '{}'::text[] NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"certifications" text[] DEFAULT '{}'::text[] NOT NULL,
	"application_url" varchar(2048) NOT NULL,
	"source_listing_url" varchar(2048) NOT NULL,
	"published_at" timestamp with time zone,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL,
	"application_deadline" timestamp with time zone,
	"status" "job_status" DEFAULT 'unverified' NOT NULL,
	"provider_updated_at" timestamp with time zone,
	"verification_evidence" text NOT NULL,
	"provider_metadata" jsonb,
	"content_hash" char(64) NOT NULL,
	"structured_data_eligible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_source_external_id_unique" UNIQUE("source_id","external_id"),
	CONSTRAINT "jobs_slug_unique" UNIQUE("slug"),
	CONSTRAINT "jobs_source_listing_url_unique" UNIQUE("source_listing_url"),
	CONSTRAINT "jobs_external_id_not_blank" CHECK (length(btrim("jobs"."external_id")) > 0),
	CONSTRAINT "jobs_slug_format" CHECK ("jobs"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "jobs_title_not_blank" CHECK (length(btrim("jobs"."title")) > 0),
	CONSTRAINT "jobs_location_not_blank" CHECK (length(btrim("jobs"."location_text")) > 0),
	CONSTRAINT "jobs_overview_not_blank" CHECK (length(btrim("jobs"."overview")) > 0),
	CONSTRAINT "jobs_application_url_format" CHECK ("jobs"."application_url" ~ '^https://'),
	CONSTRAINT "jobs_source_listing_url_format" CHECK ("jobs"."source_listing_url" ~ '^https://'),
	CONSTRAINT "jobs_country_pair" CHECK (("jobs"."country_code" IS NULL) = ("jobs"."country_name" IS NULL)),
	CONSTRAINT "jobs_country_code_format" CHECK ("jobs"."country_code" IS NULL OR "jobs"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "jobs_salary_complete" CHECK (
    ("jobs"."salary_min" IS NULL AND "jobs"."salary_max" IS NULL AND "jobs"."salary_currency" IS NULL AND "jobs"."salary_pay_period" IS NULL) OR
    (("jobs"."salary_min" IS NOT NULL OR "jobs"."salary_max" IS NOT NULL) AND "jobs"."salary_currency" ~ '^[A-Z]{3}$' AND "jobs"."salary_pay_period" IS NOT NULL)
  ),
	CONSTRAINT "jobs_salary_range" CHECK (
    ("jobs"."salary_min" IS NULL OR "jobs"."salary_min" >= 0) AND
    ("jobs"."salary_max" IS NULL OR "jobs"."salary_max" >= 0) AND
    ("jobs"."salary_min" IS NULL OR "jobs"."salary_max" IS NULL OR "jobs"."salary_max" >= "jobs"."salary_min")
  ),
	CONSTRAINT "jobs_deadline_after_publication" CHECK ("jobs"."published_at" IS NULL OR "jobs"."application_deadline" IS NULL OR "jobs"."application_deadline" >= "jobs"."published_at"),
	CONSTRAINT "jobs_verified_after_collection" CHECK ("jobs"."last_verified_at" >= "jobs"."collected_at"),
	CONSTRAINT "jobs_verification_evidence_not_blank" CHECK (length(btrim("jobs"."verification_evidence")) > 0),
	CONSTRAINT "jobs_content_hash_format" CHECK ("jobs"."content_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_employer_id_job_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."job_employers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_sources_employer_active_idx" ON "job_sources" USING btree ("employer_id","is_active");--> statement-breakpoint
CREATE INDEX "jobs_status_published_idx" ON "jobs" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "jobs_category_status_idx" ON "jobs" USING btree ("category","status");--> statement-breakpoint
CREATE INDEX "jobs_country_status_idx" ON "jobs" USING btree ("country_code","status");--> statement-breakpoint
CREATE INDEX "jobs_workplace_status_idx" ON "jobs" USING btree ("workplace_arrangement","status");--> statement-breakpoint
CREATE INDEX "jobs_experience_status_idx" ON "jobs" USING btree ("experience_level","status");--> statement-breakpoint
CREATE INDEX "jobs_employment_status_idx" ON "jobs" USING btree ("employment_type","status");--> statement-breakpoint
CREATE INDEX "jobs_source_verified_idx" ON "jobs" USING btree ("source_id","last_verified_at");