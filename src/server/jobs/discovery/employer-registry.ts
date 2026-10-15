import type { EmployerBoard } from "./types.ts";

export const VERIFIED_EMPLOYER_BOARDS = Object.freeze([
  {
    employerSlug: "canonical", employerName: "Canonical", provider: "greenhouse", externalSourceId: "canonical",
    canonicalUrl: "https://job-boards.greenhouse.io/canonical", careersUrl: "https://canonical.com/careers/all", websiteUrl: "https://canonical.com",
  },
  {
    employerSlug: "moniepoint", employerName: "Moniepoint", provider: "greenhouse", externalSourceId: "moniepoint",
    canonicalUrl: "https://job-boards.eu.greenhouse.io/moniepoint", careersUrl: "https://moniepoint.com/careers", websiteUrl: "https://moniepoint.com",
  },
  {
    employerSlug: "supabase", employerName: "Supabase", provider: "ashby", externalSourceId: "Supabase",
    canonicalUrl: "https://jobs.ashbyhq.com/Supabase", careersUrl: "https://supabase.com/careers", websiteUrl: "https://supabase.com",
  },
  {
    employerSlug: "veeva-systems", employerName: "Veeva Systems", provider: "lever", externalSourceId: "veeva",
    canonicalUrl: "https://jobs.lever.co/veeva", careersUrl: "https://careers.veeva.com", websiteUrl: "https://www.veeva.com",
    providerScope: { department: "Engineering" },
    verifiedPostingIds: ["47279623-8cbf-42f9-8f41-461c25af2edf"],
  },
  {
    employerSlug: "gitlab", employerName: "GitLab", provider: "greenhouse", externalSourceId: "gitlab",
    canonicalUrl: "https://job-boards.greenhouse.io/gitlab", careersUrl: "https://about.gitlab.com/jobs/", websiteUrl: "https://about.gitlab.com",
  },
  {
    employerSlug: "grafana-labs", employerName: "Grafana Labs", provider: "greenhouse", externalSourceId: "grafanalabs",
    canonicalUrl: "https://job-boards.greenhouse.io/grafanalabs", careersUrl: "https://grafana.com/careers/", websiteUrl: "https://grafana.com",
  },
  {
    employerSlug: "tailscale", employerName: "Tailscale", provider: "greenhouse", externalSourceId: "tailscale",
    canonicalUrl: "https://job-boards.greenhouse.io/tailscale", careersUrl: "https://tailscale.com/careers", websiteUrl: "https://tailscale.com",
  },
] satisfies readonly EmployerBoard[]);

export const JOB_DISCOVERY_CONCURRENCY = 3;
export const JOB_BOARD_TIMEOUT_MS = 30_000;
export const JOB_BOARD_MAX_BYTES = 6 * 1024 * 1024;
export const JOB_BOARD_MAX_RECORDS = 600;
export const JOB_DISCOVERY_RETRY_DELAY_MS = 750;
