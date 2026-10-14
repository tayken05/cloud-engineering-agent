import Link from "next/link";

import {
  buildJobQuery,
  formatJobLabel,
  JOB_CATEGORY_VALUES,
  JOB_EMPLOYMENT_VALUES,
  JOB_EXPERIENCE_VALUES,
  JOB_WORKPLACE_VALUES,
  type JobFilters as JobFilterValues,
} from "@/features/jobs/job-filters";
import type { JobCatalog } from "@/server/jobs/list-jobs";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const salaryFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

export function JobFilters({ catalog, filters }: { catalog?: JobCatalog; filters: JobFilterValues }) {
  return (
    <form className="job-filters" action="/jobs" method="get" aria-label="Filter jobs and opportunities">
      <label className="job-search-field">
        <span>Search</span>
        <input name="q" type="search" maxLength={100} defaultValue={filters.query ?? ""} placeholder="Title, employer, or skill" />
      </label>
      <label>
        <span>Category</span>
        <select name="category" defaultValue={filters.category ?? ""}>
          <option value="">All categories</option>
          {JOB_CATEGORY_VALUES.map((value) => <option key={value} value={value}>{formatJobLabel(value)}</option>)}
        </select>
      </label>
      <label>
        <span>Employer</span>
        <select name="employer" defaultValue={filters.employer ?? ""}>
          <option value="">All employers</option>
          {catalog?.employers.map((employer) => <option key={employer.slug} value={employer.slug}>{employer.name}</option>)}
        </select>
      </label>
      <label>
        <span>Specialization</span>
        <select name="specialization" defaultValue={filters.specialization ?? ""}>
          <option value="">All specializations</option>
          {catalog?.specializations.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>Country</span>
        <select name="country" defaultValue={filters.country ?? ""}>
          <option value="">All countries</option>
          {catalog?.countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select>
      </label>
      <label>
        <span>Work arrangement</span>
        <select name="workplace" defaultValue={filters.workplace ?? ""}>
          <option value="">All arrangements</option>
          {JOB_WORKPLACE_VALUES.map((value) => <option key={value} value={value}>{formatJobLabel(value)}</option>)}
        </select>
      </label>
      <label>
        <span>Experience</span>
        <select name="experience" defaultValue={filters.experience ?? ""}>
          <option value="">All levels</option>
          {JOB_EXPERIENCE_VALUES.map((value) => <option key={value} value={value}>{formatJobLabel(value)}</option>)}
        </select>
      </label>
      <label>
        <span>Employment</span>
        <select name="employment" defaultValue={filters.employment ?? ""}>
          <option value="">All types</option>
          {JOB_EMPLOYMENT_VALUES.map((value) => <option key={value} value={value}>{formatJobLabel(value)}</option>)}
        </select>
      </label>
      <label>
        <span>Vacancy status</span>
        <select name="status" defaultValue={filters.status}>
          <option value="open">Open</option>
          <option value="expired">Expired</option>
          <option value="closed">Closed</option>
          <option value="all">All public statuses</option>
        </select>
      </label>
      <label className="job-checkbox">
        <input name="salary" type="checkbox" value="disclosed" defaultChecked={filters.salaryDisclosed} />
        <span>Salary disclosed</span>
      </label>
      <div className="job-filter-actions">
        <button type="submit">Search opportunities</button>
        <Link href="/jobs">Clear filters</Link>
      </div>
    </form>
  );
}

export function JobsExplorer({ catalog, filters }: { catalog: JobCatalog; filters: JobFilterValues }) {
  if (catalog.items.length === 0) {
    return (
      <section className="source-state" aria-labelledby="jobs-empty-title">
        <span className="badge">0 matching vacancies</span>
        <h2 id="jobs-empty-title">No verified jobs match these filters</h2>
        <p>Try a broader category, location, or experience level. Listings are included only when an official employer or authorized job board can be verified.</p>
        <Link className="text-link" href="/jobs">Clear all filters</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="jobs-results-title">
      <div className="source-results-heading">
        <div>
          <p className="eyebrow">Official employer listings</p>
          <h2 id="jobs-results-title">Current opportunities</h2>
        </div>
        <span className="badge">{catalog.total} {catalog.total === 1 ? "vacancy" : "vacancies"}</span>
      </div>
      <ol className="job-list">
        {catalog.items.map((job) => (
          <li className="job-card" key={job.id}>
            <div className="job-card-heading">
              <div>
                <p className="job-employer">{job.employerName}</p>
                <h3><Link href={`/jobs/${job.slug}`}>{job.title}</Link></h3>
              </div>
              <span className={`job-status job-status-${job.status}`}>{formatJobLabel(job.status)}</span>
            </div>
            <p className="job-overview">{job.overview}</p>
            <div className="job-tags" aria-label="Vacancy attributes">
              <span>{formatJobLabel(job.category)}</span>
              <span>{job.locationText}</span>
              {job.workplaceArrangement ? <span>{formatJobLabel(job.workplaceArrangement)}</span> : null}
              {job.experienceLevel ? <span>{formatJobLabel(job.experienceLevel)}</span> : null}
              {job.employmentType ? <span>{formatJobLabel(job.employmentType)}</span> : null}
              {job.salaryCurrency ? <span>{formatSalary(job)}</span> : null}
            </div>
            <div className="job-card-footer">
              <span>
                Verified <time dateTime={job.lastVerifiedAt.toISOString()}>{dateFormatter.format(job.lastVerifiedAt)}</time>
              </span>
              <Link className="text-link" href={`/jobs/${job.slug}`}>View vacancy</Link>
            </div>
          </li>
        ))}
      </ol>
      <Pagination catalog={catalog} filters={filters} />
      <p className="source-disclaimer">
        Listing presence is verified against an employer or authorized recruiting board. Employers remain responsible for the vacancy, selection process, and application outcome.
      </p>
    </section>
  );
}

function Pagination({ catalog, filters }: { catalog: JobCatalog; filters: JobFilterValues }) {
  if (catalog.pageCount <= 1) return null;
  return (
    <nav className="job-pagination" aria-label="Jobs pagination">
      {catalog.page > 1 ? <Link href={buildJobQuery(filters, catalog.page - 1)}>Previous</Link> : <span />}
      <span>Page {catalog.page} of {catalog.pageCount}</span>
      {catalog.page < catalog.pageCount ? <Link href={buildJobQuery(filters, catalog.page + 1)}>Next</Link> : <span />}
    </nav>
  );
}

export function JobsError() {
  return (
    <section className="source-state source-error" role="status" aria-labelledby="jobs-error-title">
      <span className="badge">Temporarily unavailable</span>
      <h2 id="jobs-error-title">Jobs could not be loaded</h2>
      <p>The database request did not complete. No job or application data was changed.</p>
    </section>
  );
}

function formatSalary(job: JobCatalog["items"][number]): string {
  const range = job.salaryMin !== null && job.salaryMax !== null
    ? `${salaryFormatter.format(job.salaryMin)}–${salaryFormatter.format(job.salaryMax)}`
    : salaryFormatter.format(job.salaryMin ?? job.salaryMax ?? 0);
  return `${job.salaryCurrency} ${range}${job.salaryPayPeriod ? ` / ${job.salaryPayPeriod}` : ""}`;
}
