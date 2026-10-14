import type { JobDetailRecord } from "@/server/jobs/list-jobs";

const EMPLOYMENT_TYPES: Readonly<Record<NonNullable<JobDetailRecord["employmentType"]>, string>> = {
  contract: "CONTRACTOR",
  full_time: "FULL_TIME",
  internship: "INTERN",
  part_time: "PART_TIME",
  temporary: "TEMPORARY",
};

export function buildJobPostingStructuredData(job: JobDetailRecord) {
  if (
    !job.structuredDataEligible ||
    job.status !== "open" ||
    !job.publishedAt ||
    job.responsibilities.length === 0 ||
    job.requirements.length === 0
  ) return null;

  const remote = job.workplaceArrangement === "remote";
  if (remote && !job.remoteRestriction) return null;
  if (!remote && !job.countryCode) return null;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: [
      job.overview,
      `Responsibilities: ${job.responsibilities.join("; ")}`,
      `Requirements: ${job.requirements.join("; ")}`,
    ].join("\n\n"),
    datePosted: job.publishedAt.toISOString(),
    directApply: false,
    hiringOrganization: {
      "@type": "Organization",
      name: job.employerName,
      sameAs: job.employerWebsiteUrl,
    },
    ...(job.employmentType ? { employmentType: EMPLOYMENT_TYPES[job.employmentType] } : {}),
    ...(job.applicationDeadline ? { validThrough: job.applicationDeadline.toISOString() } : {}),
  };

  if (remote) {
    data.jobLocationType = "TELECOMMUTE";
    if (job.remoteCountries?.length) {
      data.applicantLocationRequirements = job.remoteCountries.map((country) => ({
        "@type": "Country",
        name: country,
      }));
    }
  } else {
    data.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.city ? { addressLocality: job.city } : {}),
        ...(job.region ? { addressRegion: job.region } : {}),
        addressCountry: job.countryCode,
      },
    };
  }

  if (job.salaryCurrency && (job.salaryMin !== null || job.salaryMax !== null) && job.salaryPayPeriod) {
    data.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.salaryCurrency,
      value: {
        "@type": "QuantitativeValue",
        ...(job.salaryMin !== null ? { minValue: job.salaryMin } : {}),
        ...(job.salaryMax !== null ? { maxValue: job.salaryMax } : {}),
        unitText: job.salaryPayPeriod.toUpperCase(),
      },
    };
  }
  return data;
}

export function serializeStructuredData(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
