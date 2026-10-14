import { createHash } from "node:crypto";

export const jobsImportConfig = Object.freeze({
  database: "neondb",
  developmentEndpoint: "ep-sweet-bread-b72xtg4u",
  productionEndpoint: "ep-spring-grass-b7iye83x",
  productionConfirmation: "IMPORT VERIFIED JOBS INTO NEON MAIN ep-spring-grass-b7iye83x",
});

export class JobsImportGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "JobsImportGuardError";
  }
}

function stop(message) {
  throw new JobsImportGuardError(message);
}

function httpsUrl(value, field) {
  let url;
  try { url = new URL(value); } catch { stop(`${field} must be a valid URL.`); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) stop(`${field} must be credential-free HTTPS.`);
  return url;
}

export function hashInitialJob(job) {
  return createHash("sha256").update(JSON.stringify(job)).digest("hex");
}

export function validateInitialJobCatalog(employers, sources, jobs) {
  if (employers.length < 1 || sources.length < 1 || jobs.length < 1) stop("The initial jobs catalog must not be empty.");
  const employerSlugs = new Set();
  const employerUrls = new Set();
  for (const employer of employers) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(employer.slug) || !employer.name.trim()) stop("An employer identity is invalid.");
    const website = httpsUrl(employer.websiteUrl, "Employer website").toString();
    httpsUrl(employer.verificationUrl, "Employer verification URL");
    if (employerSlugs.has(employer.slug) || employerUrls.has(website)) stop("Employer identities must be unique.");
    employerSlugs.add(employer.slug);
    employerUrls.add(website);
  }

  const sourceIdentities = new Set();
  const sourceUrls = new Set();
  for (const source of sources) {
    if (!employerSlugs.has(source.employerSlug) || !source.externalSourceId.trim()) stop("A job source does not resolve to an employer.");
    const canonical = httpsUrl(source.canonicalUrl, "Job source URL");
    httpsUrl(source.verificationUrl, "Job source verification URL");
    const expectedHosts = {
      ashby: ["jobs.ashbyhq.com"],
      employer: [canonical.hostname],
      greenhouse: ["job-boards.greenhouse.io", "job-boards.eu.greenhouse.io"],
      lever: ["jobs.lever.co", "jobs.eu.lever.co"],
    }[source.provider];
    if (!expectedHosts?.includes(canonical.hostname)) stop("A job source host does not match its provider.");
    const identity = `${source.provider}:${source.externalSourceId}`;
    if (sourceIdentities.has(identity) || sourceUrls.has(canonical.toString())) stop("Job source identities must be unique.");
    sourceIdentities.add(identity);
    sourceUrls.add(canonical.toString());
  }

  const ids = new Set();
  const slugs = new Set();
  const listingUrls = new Set();
  const approvedApplicationHosts = new Set([
    "job-boards.greenhouse.io", "job-boards.eu.greenhouse.io", "jobs.ashbyhq.com", "jobs.lever.co", "jobs.eu.lever.co",
  ]);
  for (const job of jobs) {
    if (!sourceIdentities.has(`${sources.find((source) => source.externalSourceId === job.sourceExternalId)?.provider}:${job.sourceExternalId}`)) stop("A job does not resolve to an approved source.");
    if (!job.externalId.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(job.slug) || !job.title.trim() || !job.overview.trim() || !job.locationText.trim()) stop("A required job identity or description is invalid.");
    const sourceUrl = httpsUrl(job.sourceListingUrl, "Source listing URL");
    const applicationUrl = httpsUrl(job.applicationUrl, "Application URL");
    if (!approvedApplicationHosts.has(sourceUrl.hostname) || !approvedApplicationHosts.has(applicationUrl.hostname)) stop("A job URL is not hosted by an approved recruiting provider.");
    const identity = `${job.sourceExternalId}:${job.externalId}`;
    if (ids.has(identity) || slugs.has(job.slug) || listingUrls.has(sourceUrl.toString())) stop("Job identities, slugs, and source URLs must be unique.");
    ids.add(identity); slugs.add(job.slug); listingUrls.add(sourceUrl.toString());
    if ((job.countryCode === null) !== (job.countryName === null) || (job.countryCode && !/^[A-Z]{2}$/.test(job.countryCode))) stop("A job country identity is invalid.");
    if (job.remoteCountries?.some((country) => !/^[A-Z]{2}$/.test(country))) stop("Remote country codes must be uppercase ISO alpha-2 values.");
    const hasSalary = job.salaryMin !== null || job.salaryMax !== null;
    if (hasSalary !== (job.salaryCurrency !== null && job.salaryPayPeriod !== null)) stop("Salary amount, currency, and pay period must be supplied together.");
    if ((job.salaryMin !== null && job.salaryMin < 0) || (job.salaryMax !== null && job.salaryMax < 0) || (job.salaryMin !== null && job.salaryMax !== null && job.salaryMax < job.salaryMin)) stop("A salary range is invalid.");
    if (job.salaryCurrency && !/^[A-Z]{3}$/.test(job.salaryCurrency)) stop("Salary currency must be an uppercase ISO code.");
    for (const value of [job.publishedAt, job.providerUpdatedAt, job.applicationDeadline]) {
      if (value !== null && Number.isNaN(Date.parse(value))) stop("A job timestamp is invalid.");
    }
    for (const values of [job.responsibilities, job.requirements, job.skills, job.certifications]) {
      if (values.some((value) => !value.trim())) stop("Job lists must not contain blank values.");
    }
  }
  return Object.freeze({ employers, jobs, sources });
}

export function planInitialJobs(existing, catalogJobs) {
  const missing = [];
  const retained = [];
  for (const job of catalogJobs) {
    const matches = existing.filter((row) =>
      (row.sourceExternalId === job.sourceExternalId && row.externalId === job.externalId) ||
      row.slug === job.slug || row.sourceListingUrl === job.sourceListingUrl,
    );
    if (matches.length === 0) { missing.push(job); continue; }
    if (matches.length !== 1) stop("Existing job identities are split across multiple rows.");
    const match = matches[0];
    if (
      match.sourceExternalId !== job.sourceExternalId ||
      match.externalId !== job.externalId ||
      match.slug !== job.slug ||
      match.sourceListingUrl !== job.sourceListingUrl ||
      match.contentHash !== hashInitialJob(job)
    ) stop("An existing job conflicts with the approved catalog.");
    retained.push(job);
  }
  return Object.freeze({ missing, retained });
}

export function parseJobsImportCommand(arguments_) {
  if (arguments_.length !== 2) stop("Choose --development|--production and --preflight|--execute.");
  const [environment, mode] = arguments_;
  if (!new Set(["--development", "--production"]).has(environment)) stop("Choose --development or --production.");
  if (!new Set(["--preflight", "--execute"]).has(mode)) stop("Choose --preflight or --execute.");
  return Object.freeze({ environment: environment.slice(2), mode: mode.slice(2) });
}

export function assertProviderJob(job, source, record) {
  if (source.provider === "greenhouse") {
    if (String(record?.id) !== job.externalId || record?.title !== job.title.replace(" — ", " - ") && record?.title !== job.title || record?.absolute_url !== job.sourceListingUrl || record?.location?.name !== job.providerMetadata.providerLocation) stop(`Greenhouse no longer matches ${job.slug}.`);
    return;
  }
  if (source.provider === "ashby") {
    const publishedMatches = typeof record?.publishedAt === "string" && job.publishedAt !== null &&
      Date.parse(record.publishedAt) === Date.parse(job.publishedAt);
    if (record?.jobUrl !== job.sourceListingUrl || record?.applyUrl !== job.applicationUrl || record?.title !== job.title || record?.isListed === false || record?.location !== job.providerMetadata.providerLocation || !publishedMatches) stop(`Ashby no longer matches ${job.slug}.`);
    return;
  }
  if (source.provider === "lever") {
    if (record?.id !== job.externalId || record?.text !== job.title.replace(" — ", " - ") || record?.hostedUrl !== job.sourceListingUrl || record?.applyUrl !== job.applicationUrl || record?.categories?.location !== job.providerMetadata.providerLocation || record?.workplaceType !== job.providerMetadata.providerWorkplaceType) stop(`Lever no longer matches ${job.slug}.`);
    return;
  }
  stop("The initial importer has no verifier for this provider.");
}
