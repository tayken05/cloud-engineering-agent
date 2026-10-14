import "server-only";

import { and, desc, eq, ilike, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";

import type { JobFilters } from "@/features/jobs/job-filters";
import { createDatabase } from "@/server/db/client";
import { jobEmployers, jobs, jobSources } from "@/server/db/schema";

export const JOB_PAGE_SIZE = 12;
export const JOB_SITEMAP_LIMIT = 1_000;

export type JobListRecord = Readonly<{
  applicationDeadline: Date | null;
  category: (typeof jobs.category.enumValues)[number];
  countryCode: string | null;
  countryName: string | null;
  employerName: string;
  employmentType: (typeof jobs.employmentType.enumValues)[number] | null;
  experienceLevel: (typeof jobs.experienceLevel.enumValues)[number] | null;
  id: string;
  lastVerifiedAt: Date;
  locationText: string;
  overview: string;
  publishedAt: Date | null;
  salaryCurrency: string | null;
  salaryMax: number | null;
  salaryMin: number | null;
  salaryPayPeriod: (typeof jobs.salaryPayPeriod.enumValues)[number] | null;
  slug: string;
  status: (typeof jobs.status.enumValues)[number];
  title: string;
  workplaceArrangement: (typeof jobs.workplaceArrangement.enumValues)[number] | null;
}>;

export type JobCatalog = Readonly<{
  countries: readonly Readonly<{ code: string; name: string }>[];
  employers: readonly Readonly<{ name: string; slug: string }>[];
  items: readonly JobListRecord[];
  page: number;
  pageCount: number;
  specializations: readonly string[];
  total: number;
}>;

export type JobDetailRecord = JobListRecord & Readonly<{
  applicationUrl: string;
  certifications: readonly string[];
  city: string | null;
  employerVerificationUrl: string;
  employerWebsiteUrl: string;
  provider: (typeof jobSources.provider.enumValues)[number];
  region: string | null;
  remoteCountries: readonly string[] | null;
  remoteRestriction: string | null;
  requirements: readonly string[];
  responsibilities: readonly string[];
  skills: readonly string[];
  sourceListingUrl: string;
  sourceUrl: string;
  specialization: string | null;
  structuredDataEligible: boolean;
  verificationEvidence: string;
}>;

export class JobsQueryError extends Error {
  constructor() {
    super("Jobs could not be loaded.");
    this.name = "JobsQueryError";
  }
}

const listSelection = {
  applicationDeadline: jobs.applicationDeadline,
  category: jobs.category,
  countryCode: jobs.countryCode,
  countryName: jobs.countryName,
  employerName: jobEmployers.name,
  employmentType: jobs.employmentType,
  experienceLevel: jobs.experienceLevel,
  id: jobs.id,
  lastVerifiedAt: jobs.lastVerifiedAt,
  locationText: jobs.locationText,
  overview: jobs.overview,
  publishedAt: jobs.publishedAt,
  salaryCurrency: jobs.salaryCurrency,
  salaryMax: jobs.salaryMax,
  salaryMin: jobs.salaryMin,
  salaryPayPeriod: jobs.salaryPayPeriod,
  slug: jobs.slug,
  status: jobs.status,
  title: jobs.title,
  workplaceArrangement: jobs.workplaceArrangement,
} as const;

function publicStatusCondition(filters: JobFilters): SQL {
  return filters.status === "all"
    ? ne(jobs.status, "unverified")
    : eq(jobs.status, filters.status);
}

function buildConditions(filters: JobFilters): SQL[] {
  const conditions: SQL[] = [publicStatusCondition(filters)];
  if (filters.category) conditions.push(eq(jobs.category, filters.category));
  if (filters.employment) conditions.push(eq(jobs.employmentType, filters.employment));
  if (filters.employer) conditions.push(eq(jobEmployers.slug, filters.employer));
  if (filters.experience) conditions.push(eq(jobs.experienceLevel, filters.experience));
  if (filters.workplace) conditions.push(eq(jobs.workplaceArrangement, filters.workplace));
  if (filters.salaryDisclosed) conditions.push(isNotNull(jobs.salaryCurrency));
  if (filters.specialization) conditions.push(eq(jobs.specialization, filters.specialization));
  if (filters.country) {
    conditions.push(or(
      eq(jobs.countryCode, filters.country),
      sql`${filters.country} = ANY(coalesce(${jobs.remoteCountries}, ARRAY[]::text[]))`,
    )!);
  }
  if (filters.query) {
    const query = `%${filters.query}%`;
    conditions.push(or(
      ilike(jobs.title, query),
      ilike(jobEmployers.name, query),
      ilike(jobs.specialization, query),
      sql`array_to_string(${jobs.skills}, ' ') ILIKE ${query}`,
    )!);
  }
  return conditions;
}

export async function listJobs(
  filters: JobFilters,
  options: Readonly<{ signal?: AbortSignal }> = {},
): Promise<JobCatalog> {
  const conditions = buildConditions(filters);
  const database = createDatabase(options);

  try {
    const [items, countRows, countryRows, employerRows, specializationRows] = await Promise.all([
      database
        .select(listSelection)
        .from(jobs)
        .innerJoin(jobSources, eq(jobs.sourceId, jobSources.id))
        .innerJoin(jobEmployers, eq(jobSources.employerId, jobEmployers.id))
        .where(and(...conditions))
        .orderBy(desc(sql`coalesce(${jobs.publishedAt}, ${jobs.lastVerifiedAt})`), desc(jobs.id))
        .limit(JOB_PAGE_SIZE)
        .offset((filters.page - 1) * JOB_PAGE_SIZE),
      database
        .select({ count: sql<number>`count(*)::integer` })
        .from(jobs)
        .innerJoin(jobSources, eq(jobs.sourceId, jobSources.id))
        .innerJoin(jobEmployers, eq(jobSources.employerId, jobEmployers.id))
        .where(and(...conditions)),
      database
        .selectDistinct({ code: jobs.countryCode, name: jobs.countryName })
        .from(jobs)
        .where(and(ne(jobs.status, "unverified"), isNotNull(jobs.countryCode), isNotNull(jobs.countryName)))
        .orderBy(jobs.countryName),
      database
        .selectDistinct({ name: jobEmployers.name, slug: jobEmployers.slug })
        .from(jobs)
        .innerJoin(jobSources, eq(jobs.sourceId, jobSources.id))
        .innerJoin(jobEmployers, eq(jobSources.employerId, jobEmployers.id))
        .where(ne(jobs.status, "unverified"))
        .orderBy(jobEmployers.name),
      database
        .selectDistinct({ specialization: jobs.specialization })
        .from(jobs)
        .where(and(ne(jobs.status, "unverified"), isNotNull(jobs.specialization)))
        .orderBy(jobs.specialization),
    ]);
    const total = countRows[0]?.count ?? 0;
    return Object.freeze({
      countries: countryRows.flatMap((country) => country.code && country.name
        ? [{ code: country.code, name: country.name }]
        : []),
      employers: employerRows,
      items,
      page: filters.page,
      pageCount: Math.max(1, Math.ceil(total / JOB_PAGE_SIZE)),
      specializations: specializationRows.flatMap((row) => row.specialization ? [row.specialization] : []),
      total,
    });
  } catch {
    throw new JobsQueryError();
  }
}

export async function getJobBySlug(
  slug: string,
  options: Readonly<{ signal?: AbortSignal }> = {},
): Promise<JobDetailRecord | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) return null;
  try {
    const database = createDatabase(options);
    const rows = await database
      .select({
        ...listSelection,
        applicationUrl: jobs.applicationUrl,
        certifications: jobs.certifications,
        city: jobs.city,
        employerVerificationUrl: jobEmployers.verificationUrl,
        employerWebsiteUrl: jobEmployers.websiteUrl,
        provider: jobSources.provider,
        region: jobs.region,
        remoteCountries: jobs.remoteCountries,
        remoteRestriction: jobs.remoteRestriction,
        requirements: jobs.requirements,
        responsibilities: jobs.responsibilities,
        skills: jobs.skills,
        sourceListingUrl: jobs.sourceListingUrl,
        sourceUrl: jobSources.canonicalUrl,
        specialization: jobs.specialization,
        structuredDataEligible: jobs.structuredDataEligible,
        verificationEvidence: jobs.verificationEvidence,
      })
      .from(jobs)
      .innerJoin(jobSources, eq(jobs.sourceId, jobSources.id))
      .innerJoin(jobEmployers, eq(jobSources.employerId, jobEmployers.id))
      .where(and(eq(jobs.slug, slug), ne(jobs.status, "unverified")))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    throw new JobsQueryError();
  }
}

export async function listOpenJobSitemapEntries(
  options: Readonly<{ signal?: AbortSignal }> = {},
) {
  try {
    const database = createDatabase(options);
    return await database
      .select({ lastModified: jobs.updatedAt, slug: jobs.slug })
      .from(jobs)
      .where(eq(jobs.status, "open"))
      .orderBy(desc(jobs.updatedAt))
      .limit(JOB_SITEMAP_LIMIT);
  } catch {
    throw new JobsQueryError();
  }
}
