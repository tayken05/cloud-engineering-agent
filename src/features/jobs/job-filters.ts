export const JOB_CATEGORY_VALUES = [
  "cloud_engineering",
  "devops_infrastructure",
  "devsecops",
  "networking",
  "cybersecurity",
  "linux",
  "site_reliability",
  "platform_engineering",
  "software_engineering",
  "ai_engineering",
] as const;

export const JOB_EXPERIENCE_VALUES = [
  "entry_level", "junior", "mid_level", "senior", "lead", "manager", "executive",
] as const;
export const JOB_EMPLOYMENT_VALUES = [
  "full_time", "part_time", "contract", "temporary", "internship",
] as const;
export const JOB_WORKPLACE_VALUES = ["remote", "hybrid", "onsite"] as const;
export const PUBLIC_JOB_STATUS_VALUES = ["open", "expired", "closed", "all"] as const;
export const JOB_SALARY_VALUES = ["disclosed"] as const;

export type JobCategory = (typeof JOB_CATEGORY_VALUES)[number];
export type JobExperience = (typeof JOB_EXPERIENCE_VALUES)[number];
export type JobEmployment = (typeof JOB_EMPLOYMENT_VALUES)[number];
export type JobWorkplace = (typeof JOB_WORKPLACE_VALUES)[number];
export type PublicJobStatus = (typeof PUBLIC_JOB_STATUS_VALUES)[number];

export type JobFilters = Readonly<{
  category?: JobCategory;
  country?: string;
  employer?: string;
  employment?: JobEmployment;
  experience?: JobExperience;
  page: number;
  query?: string;
  salaryDisclosed: boolean;
  specialization?: string;
  status: PublicJobStatus;
  workplace?: JobWorkplace;
}>;

export type JobSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

const MAX_SEARCH_LENGTH = 100;
export const MAX_JOB_PAGE = 100;

function first(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function member<const T extends readonly string[]>(values: T, value: string | undefined): value is T[number] {
  return value !== undefined && values.includes(value);
}

export function parseJobFilters(params: JobSearchParams): JobFilters {
  const category = first(params.category);
  const country = first(params.country)?.trim().toUpperCase();
  const employment = first(params.employment);
  const employer = first(params.employer)?.trim().slice(0, 128);
  const experience = first(params.experience);
  const pageCandidate = Number.parseInt(first(params.page) ?? "1", 10);
  const query = first(params.q)?.trim().slice(0, MAX_SEARCH_LENGTH);
  const salary = first(params.salary);
  const specialization = first(params.specialization)?.trim().slice(0, MAX_SEARCH_LENGTH);
  const status = first(params.status);
  const workplace = first(params.workplace);

  return {
    ...(member(JOB_CATEGORY_VALUES, category) ? { category } : {}),
    ...(country && /^[A-Z]{2}$/.test(country) ? { country } : {}),
    ...(member(JOB_EMPLOYMENT_VALUES, employment) ? { employment } : {}),
    ...(employer && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(employer) ? { employer } : {}),
    ...(member(JOB_EXPERIENCE_VALUES, experience) ? { experience } : {}),
    page: Number.isInteger(pageCandidate) && pageCandidate >= 1
      ? Math.min(pageCandidate, MAX_JOB_PAGE)
      : 1,
    ...(query ? { query } : {}),
    salaryDisclosed: member(JOB_SALARY_VALUES, salary),
    ...(specialization ? { specialization } : {}),
    status: member(PUBLIC_JOB_STATUS_VALUES, status) ? status : "open",
    ...(member(JOB_WORKPLACE_VALUES, workplace) ? { workplace } : {}),
  };
}

export function formatJobLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    ai_engineering: "AI Engineering",
    cloud_engineering: "Cloud Engineering",
    devops_infrastructure: "DevOps & Infrastructure",
    devsecops: "DevSecOps",
    entry_level: "Entry level",
    full_time: "Full time",
    mid_level: "Mid level",
    part_time: "Part time",
    site_reliability: "Site Reliability",
    software_engineering: "Software Engineering",
  };
  if (labels[value]) return labels[value];
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function buildJobQuery(filters: JobFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.category) params.set("category", filters.category);
  if (filters.country) params.set("country", filters.country);
  if (filters.employer) params.set("employer", filters.employer);
  if (filters.workplace) params.set("workplace", filters.workplace);
  if (filters.experience) params.set("experience", filters.experience);
  if (filters.employment) params.set("employment", filters.employment);
  if (filters.salaryDisclosed) params.set("salary", "disclosed");
  if (filters.specialization) params.set("specialization", filters.specialization);
  if (filters.status !== "open") params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}
