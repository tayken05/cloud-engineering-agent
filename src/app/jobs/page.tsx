import type { Metadata } from "next";
import { connection } from "next/server";

import { JobFilters, JobsError, JobsExplorer } from "@/components/jobs/jobs-explorer";
import { PageLayout } from "@/components/workspace/page-layout";
import { parseJobFilters, type JobSearchParams } from "@/features/jobs/job-filters";
import { getSection } from "@/lib/workspace";
import { listJobs } from "@/server/jobs/list-jobs";

export const metadata: Metadata = {
  title: "Cloud Jobs & Opportunities | Cloud Engineering Agent",
  description: "Explore verified cloud engineering, DevOps, Linux, networking, security, SRE, and platform engineering vacancies from official employer sources.",
  alternates: { canonical: "/jobs" },
};

export default async function Page({ searchParams }: { searchParams: Promise<JobSearchParams> }) {
  await connection();
  const filters = parseJobFilters(await searchParams);
  const section = getSection("/jobs");

  let catalog;
  try {
    catalog = await listJobs(filters);
  } catch {
    console.error("[jobs] The database-backed jobs query failed.");
  }

  return (
    <PageLayout title={section.title} description={section.description} eyebrow={section.group}>
      <JobFilters catalog={catalog} filters={filters} />
      {catalog ? <JobsExplorer catalog={catalog} filters={filters} /> : <JobsError />}
    </PageLayout>
  );
}
