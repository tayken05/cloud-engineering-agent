import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { JobDetail } from "@/components/jobs/job-detail";
import { buildJobPostingStructuredData, serializeStructuredData } from "@/features/jobs/job-structured-data";
import { getJobBySlug } from "@/server/jobs/list-jobs";

const loadJob = cache(async (slug: string) => {
  await connection();
  return getJobBySlug(slug);
});

export async function generateMetadata({ params }: PageProps<"/jobs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const job = await loadJob(slug);
    if (!job) return { title: "Job not found | Cloud Engineering Agent" };
    return {
      title: `${job.title} at ${job.employerName} | Cloud Engineering Agent`,
      description: job.overview,
      alternates: { canonical: `/jobs/${job.slug}` },
      robots: job.status === "open" ? undefined : { index: false, follow: true },
    };
  } catch {
    return { title: "Job opportunity | Cloud Engineering Agent", robots: { index: false, follow: false } };
  }
}

export default async function Page({ params }: PageProps<"/jobs/[slug]">) {
  const { slug } = await params;
  let job;
  try {
    job = await loadJob(slug);
  } catch {
    console.error("[job-detail] The database-backed job query failed.");
    return (
      <section className="source-state source-error" role="status">
        <span className="badge">Temporarily unavailable</span>
        <h1>Job details could not be loaded</h1>
        <p>The database request did not complete. No application or job data was changed.</p>
      </section>
    );
  }
  if (!job) notFound();

  const structuredData = buildJobPostingStructuredData(job);
  return (
    <>
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
        />
      ) : null}
      <JobDetail job={job} />
    </>
  );
}
