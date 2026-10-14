import Link from "next/link";

import { formatJobLabel } from "@/features/jobs/job-filters";
import type { JobDetailRecord } from "@/server/jobs/list-jobs";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const moneyFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

export function JobDetail({ job }: { job: JobDetailRecord }) {
  const acceptingApplications = job.status === "open";
  return (
    <article className="job-detail">
      <Link className="text-link" href="/jobs">← Back to Jobs &amp; Opportunities</Link>
      <header className="job-detail-header">
        <div>
          <p className="eyebrow">{job.employerName}</p>
          <h1>{job.title}</h1>
          <p className="page-description">{job.overview}</p>
        </div>
        <span className={`job-status job-status-${job.status}`}>{formatJobLabel(job.status)}</span>
      </header>

      {!acceptingApplications ? (
        <section className="job-closed-notice" role="status">
          <strong>This listing is {job.status}.</strong>
          <p>It is retained for accurate status history and is not presented as accepting applications.</p>
        </section>
      ) : null}

      <dl className="job-facts">
        <Fact label="Employer" value={job.employerName} />
        <Fact label="Listing provider" value={formatJobLabel(job.provider)} />
        <Fact label="Specialization" value={job.specialization ?? "Not specified"} />
        <Fact label="Location" value={job.locationText} />
        <Fact label="Category" value={formatJobLabel(job.category)} />
        <Fact label="Work arrangement" value={job.workplaceArrangement ? formatJobLabel(job.workplaceArrangement) : "Not specified"} />
        <Fact label="Experience" value={job.experienceLevel ? formatJobLabel(job.experienceLevel) : "Not specified"} />
        <Fact label="Employment" value={job.employmentType ? formatJobLabel(job.employmentType) : "Not specified"} />
        <Fact label="Salary" value={formatSalary(job)} />
        <Fact label="Published" value={job.publishedAt ? dateFormatter.format(job.publishedAt) : "Not provided by source"} />
        <Fact label="Application deadline" value={job.applicationDeadline ? dateFormatter.format(job.applicationDeadline) : "Not provided by source"} />
        <Fact label="Last verified" value={dateFormatter.format(job.lastVerifiedAt)} />
      </dl>

      {job.remoteRestriction ? (
        <section className="job-detail-section">
          <h2>Applicant location</h2>
          <p>{job.remoteRestriction}</p>
        </section>
      ) : null}

      <JobListSection title="Responsibilities" values={job.responsibilities} empty="The source did not provide a usable responsibilities list." />
      <JobListSection title="Required skills and qualifications" values={job.requirements} empty="The source did not provide a usable requirements list." />
      <JobListSection title="Technical skills" values={job.skills} empty="No separate skills list was provided." />
      {job.certifications.length > 0 ? <JobListSection title="Certifications" values={job.certifications} empty="" /> : null}

      <section className="job-verification" aria-labelledby="job-verification-title">
        <div>
          <p className="eyebrow">Source and verification</p>
          <h2 id="job-verification-title">Official listing evidence</h2>
          <p>{job.verificationEvidence}</p>
          <p>This verifies that the listing was published on the stated board at the recorded time. It is not an independent vetting of the employer or hiring outcome.</p>
        </div>
        <div className="job-source-links">
          <a href={job.sourceListingUrl} target="_blank" rel="noreferrer">View original listing ↗</a>
          <a href={job.employerVerificationUrl} target="_blank" rel="noreferrer">Employer careers page ↗</a>
        </div>
      </section>

      {acceptingApplications ? (
        <a className="job-apply-link" href={job.applicationUrl} target="_blank" rel="noreferrer">
          Apply on Employer Website <span aria-hidden="true">↗</span>
        </a>
      ) : null}
      <p className="source-disclaimer">
        Cloud Engineering Agent does not employ for this role, accept applications, collect CVs, or represent the employer.
      </p>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function JobListSection({ empty, title, values }: { empty: string; title: string; values: readonly string[] }) {
  return (
    <section className="job-detail-section">
      <h2>{title}</h2>
      {values.length > 0 ? <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p>{empty}</p>}
    </section>
  );
}

function formatSalary(job: JobDetailRecord): string {
  if (!job.salaryCurrency || (job.salaryMin === null && job.salaryMax === null)) return "Not disclosed";
  const amount = job.salaryMin !== null && job.salaryMax !== null
    ? `${moneyFormatter.format(job.salaryMin)}–${moneyFormatter.format(job.salaryMax)}`
    : moneyFormatter.format(job.salaryMin ?? job.salaryMax ?? 0);
  return `${job.salaryCurrency} ${amount}${job.salaryPayPeriod ? ` per ${job.salaryPayPeriod}` : ""}`;
}
