export type InitialEmployer = Readonly<{
  name: string;
  slug: string;
  verificationUrl: string;
  websiteUrl: string;
}>;

export type InitialJobSource = Readonly<{
  canonicalUrl: string;
  employerSlug: string;
  externalSourceId: string;
  provider: "greenhouse" | "lever" | "ashby" | "employer";
  verificationUrl: string;
}>;

export type InitialJob = Readonly<{
  applicationDeadline: string | null;
  applicationUrl: string;
  category: "cloud_engineering" | "devops_infrastructure" | "devsecops" | "networking" |
    "cybersecurity" | "linux" | "site_reliability" | "platform_engineering" |
    "software_engineering" | "ai_engineering";
  certifications: readonly string[];
  city: string | null;
  countryCode: string | null;
  countryName: string | null;
  employmentType: "full_time" | "part_time" | "contract" | "temporary" | "internship" | null;
  experienceLevel: "entry_level" | "junior" | "mid_level" | "senior" | "lead" | "manager" | "executive" | null;
  externalId: string;
  overview: string;
  providerMetadata: Readonly<Record<string, string | boolean | number | null>>;
  providerUpdatedAt: string | null;
  publishedAt: string | null;
  region: string | null;
  remoteCountries: readonly string[] | null;
  remoteRestriction: string | null;
  requirements: readonly string[];
  responsibilities: readonly string[];
  salaryCurrency: string | null;
  salaryMax: number | null;
  salaryMin: number | null;
  salaryPayPeriod: "hour" | "day" | "week" | "month" | "year" | null;
  skills: readonly string[];
  slug: string;
  sourceExternalId: string;
  sourceListingUrl: string;
  specialization: string | null;
  status: "open" | "expired" | "closed" | "unverified";
  structuredDataEligible: boolean;
  title: string;
  verificationEvidence: string;
  workplaceArrangement: "remote" | "hybrid" | "onsite" | null;
  locationText: string;
}>;

export const INITIAL_JOB_EMPLOYERS = [
  {
    slug: "canonical",
    name: "Canonical",
    websiteUrl: "https://canonical.com",
    verificationUrl: "https://canonical.com/careers/all",
  },
  {
    slug: "moniepoint",
    name: "Moniepoint",
    websiteUrl: "https://moniepoint.com",
    verificationUrl: "https://moniepoint.com/careers",
  },
  {
    slug: "supabase",
    name: "Supabase",
    websiteUrl: "https://supabase.com",
    verificationUrl: "https://supabase.com/careers",
  },
  {
    slug: "veeva-systems",
    name: "Veeva Systems",
    websiteUrl: "https://www.veeva.com",
    verificationUrl: "https://careers.veeva.com",
  },
] as const satisfies readonly InitialEmployer[];

export const INITIAL_JOB_SOURCES = [
  {
    employerSlug: "canonical",
    provider: "greenhouse",
    externalSourceId: "canonical",
    canonicalUrl: "https://job-boards.greenhouse.io/canonical",
    verificationUrl: "https://canonical.com/careers/all",
  },
  {
    employerSlug: "moniepoint",
    provider: "greenhouse",
    externalSourceId: "moniepoint",
    canonicalUrl: "https://job-boards.eu.greenhouse.io/moniepoint",
    verificationUrl: "https://moniepoint.com/careers",
  },
  {
    employerSlug: "supabase",
    provider: "ashby",
    externalSourceId: "Supabase",
    canonicalUrl: "https://jobs.ashbyhq.com/Supabase",
    verificationUrl: "https://supabase.com/careers",
  },
  {
    employerSlug: "veeva-systems",
    provider: "lever",
    externalSourceId: "veeva",
    canonicalUrl: "https://jobs.lever.co/veeva",
    verificationUrl: "https://careers.veeva.com",
  },
] as const satisfies readonly InitialJobSource[];

const worldwide = {
  countryCode: null,
  countryName: null,
  region: null,
  city: null,
  remoteCountries: null,
  remoteRestriction: "Worldwide",
  workplaceArrangement: "remote" as const,
};

const noSalary = {
  salaryCurrency: null,
  salaryMax: null,
  salaryMin: null,
  salaryPayPeriod: null,
};

const common = {
  applicationDeadline: null,
  certifications: [] as const,
  status: "open" as const,
  structuredDataEligible: false,
};

export const INITIAL_JOBS = [
  {
    ...common, ...worldwide, ...noSalary,
    sourceExternalId: "canonical",
    externalId: "8249005",
    slug: "canonical-graduate-software-engineer-open-source-linux",
    title: "Graduate Software Engineer, Open Source and Linux, Canonical Ubuntu",
    specialization: "Ubuntu and open-source software engineering",
    category: "software_engineering",
    employmentType: "full_time",
    experienceLevel: "entry_level",
    locationText: "Home based — Worldwide",
    overview: "A globally remote graduate role contributing to Canonical engineering teams across Ubuntu, cloud, containers, security, and developer tooling.",
    responsibilities: [
      "Write and test resilient software for open-source products and services.",
      "Work with users and upstream communities through reviews and issue trackers.",
      "Join twice-yearly in-person engineering events.",
    ],
    requirements: [
      "A STEM degree with programming coursework and a strong academic record.",
      "Working ability in at least one of Python, Rust, C/C++, Go, JavaScript, or Java.",
      "Experience with Ubuntu or another Linux distribution and permission to travel internationally.",
    ],
    skills: ["Linux", "Open source", "Python", "Go", "Rust", "C/C++"],
    applicationUrl: "https://job-boards.greenhouse.io/canonical/jobs/8249005",
    sourceListingUrl: "https://job-boards.greenhouse.io/canonical/jobs/8249005",
    publishedAt: null,
    providerUpdatedAt: "2026-10-05T15:46:26Z",
    verificationEvidence: "Present on Canonical's official careers site and published Greenhouse board; official posting describes the role as globally remote.",
    providerMetadata: { providerLocation: "Home based - Worldwide", department: "Engineering Fast Track" },
  },
  {
    ...common, ...worldwide, ...noSalary,
    sourceExternalId: "canonical",
    externalId: "6448444",
    slug: "canonical-associate-linux-support-engineer",
    title: "Associate Linux Support Engineer",
    specialization: "Linux and cloud support",
    category: "linux",
    employmentType: null,
    experienceLevel: "entry_level",
    locationText: "Home based — Worldwide",
    overview: "A globally remote support-engineering role diagnosing Linux, cloud, desktop, server, and IoT issues for Canonical customers.",
    responsibilities: [
      "Own technical support cases from qualification through resolution or escalation.",
      "Diagnose cloud, operating-system, and Linux kernel problems.",
      "Document solutions and collaborate with senior engineers.",
    ],
    requirements: [
      "Hands-on Linux knowledge and a strong interest in open-source systems.",
      "Clear written communication and methodical troubleshooting skills.",
      "Ability to work with customers and distributed engineering teams.",
    ],
    skills: ["Linux", "Ubuntu", "Cloud support", "Troubleshooting", "Open source"],
    applicationUrl: "https://job-boards.greenhouse.io/canonical/jobs/6448444",
    sourceListingUrl: "https://job-boards.greenhouse.io/canonical/jobs/6448444",
    publishedAt: null,
    providerUpdatedAt: "2026-08-05T22:23:33Z",
    verificationEvidence: "Present on Canonical's official careers site and published Greenhouse board; official posting describes the role as globally remote.",
    providerMetadata: { providerLocation: "Home based - Worldwide", department: "Support Engineering" },
  },
  {
    ...common, ...worldwide, ...noSalary,
    sourceExternalId: "canonical",
    externalId: "2456563",
    slug: "canonical-cloud-support-engineer",
    title: "Cloud Support Engineer",
    specialization: "Ubuntu and open-source cloud support",
    category: "cloud_engineering",
    employmentType: null,
    experienceLevel: null,
    locationText: "Home based — Worldwide",
    overview: "A globally remote role supporting customer engineering teams that run Ubuntu and Canonical open-source products in cloud environments.",
    responsibilities: [
      "Investigate cloud and Linux incidents with customers through remote support channels.",
      "Translate complex technical findings into clear resolutions and guidance.",
      "Coordinate escalations and contribute reusable technical knowledge.",
    ],
    requirements: [
      "Strong Linux and cloud troubleshooting ability.",
      "Customer-focused written and verbal communication.",
      "Interest in open-source development and production systems.",
    ],
    skills: ["Ubuntu", "Linux", "Cloud infrastructure", "Root-cause analysis", "Technical support"],
    applicationUrl: "https://job-boards.greenhouse.io/canonical/jobs/2456563",
    sourceListingUrl: "https://job-boards.greenhouse.io/canonical/jobs/2456563",
    publishedAt: null,
    providerUpdatedAt: "2026-08-05T22:23:33Z",
    verificationEvidence: "Present on Canonical's official careers site and published Greenhouse board; official posting describes the role as globally remote.",
    providerMetadata: { providerLocation: "Home based - Worldwide", department: "Support Engineering" },
  },
  {
    ...common, ...worldwide, ...noSalary,
    sourceExternalId: "canonical",
    externalId: "5370815",
    slug: "canonical-junior-linux-kernel-engineer",
    title: "Junior Linux Kernel Engineer — Ubuntu",
    specialization: "Linux kernel engineering",
    category: "linux",
    employmentType: null,
    experienceLevel: "junior",
    locationText: "Home based — Worldwide",
    overview: "A globally remote junior role in Canonical's kernel team, working on Ubuntu kernels across embedded devices, servers, and cloud platforms.",
    responsibilities: [
      "Develop and maintain Ubuntu Linux kernel functionality across supported platforms.",
      "Work on partner enablement, security hardening, and performance initiatives.",
      "Contribute code reviews, testing, and upstream collaboration.",
    ],
    requirements: [
      "Strong foundations in operating systems and high-quality C programming.",
      "Interest in kernel development, hardware, and open-source collaboration.",
      "Ability to learn in a distributed engineering team.",
    ],
    skills: ["Linux kernel", "Ubuntu", "C", "Rust", "Systems programming"],
    applicationUrl: "https://job-boards.greenhouse.io/canonical/jobs/5370815",
    sourceListingUrl: "https://job-boards.greenhouse.io/canonical/jobs/5370815",
    publishedAt: null,
    providerUpdatedAt: "2026-08-05T22:23:33Z",
    verificationEvidence: "Present on Canonical's official careers site and published Greenhouse board; official posting describes the role as globally remote.",
    providerMetadata: { providerLocation: "Home based - Worldwide", department: "Devices Engineering" },
  },
  {
    ...common, ...noSalary,
    sourceExternalId: "moniepoint",
    externalId: "4701243101",
    slug: "moniepoint-application-security-engineer-nigeria",
    title: "Application Security Engineer",
    specialization: "Application security",
    category: "cybersecurity",
    employmentType: null,
    experienceLevel: "mid_level",
    workplaceArrangement: "remote",
    countryCode: "NG",
    countryName: "Nigeria",
    region: null,
    city: null,
    locationText: "Remote, Nigeria",
    remoteCountries: ["NG"],
    remoteRestriction: "Applicants must be eligible to work remotely from Nigeria.",
    overview: "A Nigeria-remote role strengthening application security through assessments, secure-development practices, and vulnerability remediation.",
    responsibilities: [
      "Assess web and mobile applications with manual and automated techniques.",
      "Work with development teams to embed security controls in the delivery lifecycle.",
      "Document vulnerabilities and guide practical remediation.",
    ],
    requirements: [
      "Applied experience with application-security testing and threat analysis.",
      "Knowledge of secure software-development practices and common web vulnerabilities.",
      "Ability to communicate findings clearly to engineering teams.",
    ],
    skills: ["Application security", "Penetration testing", "Secure SDLC", "Web security", "Mobile security"],
    applicationUrl: "https://job-boards.eu.greenhouse.io/moniepoint/jobs/4701243101",
    sourceListingUrl: "https://job-boards.eu.greenhouse.io/moniepoint/jobs/4701243101",
    publishedAt: null,
    providerUpdatedAt: "2026-10-08T13:15:54Z",
    verificationEvidence: "Present on Moniepoint's official careers page and published Greenhouse board with the location Remote, Nigeria.",
    providerMetadata: { providerLocation: "Remote, Nigeria", department: "Moniepoint MFB" },
  },
  {
    ...common, ...noSalary,
    sourceExternalId: "moniepoint",
    externalId: "4637395101",
    slug: "moniepoint-senior-site-reliability-engineer-nigeria",
    title: "Senior Site Reliability Engineer",
    specialization: "Distributed-systems reliability",
    category: "site_reliability",
    employmentType: null,
    experienceLevel: "senior",
    workplaceArrangement: "remote",
    countryCode: "NG",
    countryName: "Nigeria",
    region: null,
    city: null,
    locationText: "Remote, Nigeria",
    remoteCountries: ["NG"],
    remoteRestriction: "Applicants must be eligible to work remotely from Nigeria.",
    overview: "A Nigeria-remote SRE role improving the reliability, observability, and incident response of Moniepoint's distributed financial platform.",
    responsibilities: [
      "Define service objectives and improve production observability.",
      "Lead incident response and follow through on durable corrective work.",
      "Build automation and self-healing mechanisms for distributed services.",
    ],
    requirements: [
      "Senior experience operating distributed production systems.",
      "Strong programming, incident-management, and systems-debugging skills.",
      "Practical knowledge of metrics, tracing, and service-level objectives.",
    ],
    skills: ["SRE", "Distributed systems", "Observability", "Incident response", "Automation"],
    applicationUrl: "https://job-boards.eu.greenhouse.io/moniepoint/jobs/4637395101",
    sourceListingUrl: "https://job-boards.eu.greenhouse.io/moniepoint/jobs/4637395101",
    publishedAt: null,
    providerUpdatedAt: "2026-09-25T08:40:57Z",
    verificationEvidence: "Present on Moniepoint's official careers page and published Greenhouse board with the location Remote, Nigeria.",
    providerMetadata: { providerLocation: "Remote, Nigeria", department: "Site Reliability Engineering" },
  },
  {
    ...common, ...noSalary,
    sourceExternalId: "moniepoint",
    externalId: "4369828101",
    slug: "moniepoint-team-lead-site-reliability-engineering-lagos",
    title: "Team Lead, Site Reliability Engineering",
    specialization: "SRE technical leadership",
    category: "site_reliability",
    employmentType: null,
    experienceLevel: "lead",
    workplaceArrangement: null,
    countryCode: "NG",
    countryName: "Nigeria",
    region: "Lagos",
    city: "Lagos",
    locationText: "Lagos, Nigeria",
    remoteCountries: null,
    remoteRestriction: null,
    overview: "A Lagos-based technical leadership role setting reliability architecture, engineering standards, and team direction for Moniepoint's distributed platform.",
    responsibilities: [
      "Set technical direction and reliability standards for the SRE team.",
      "Lead observability, automation, incident management, and production-readiness practices.",
      "Mentor engineers and guide architecture for self-healing systems.",
    ],
    requirements: [
      "At least six years in SRE or backend engineering.",
      "At least two years in a lead, senior, or staff role mentoring engineers.",
      "Deep experience with distributed systems and production incident leadership.",
    ],
    skills: ["SRE leadership", "Reliability architecture", "Observability", "Incident management", "Mentoring"],
    applicationUrl: "https://job-boards.eu.greenhouse.io/moniepoint/jobs/4369828101",
    sourceListingUrl: "https://job-boards.eu.greenhouse.io/moniepoint/jobs/4369828101",
    publishedAt: null,
    providerUpdatedAt: "2026-07-24T10:08:46Z",
    verificationEvidence: "Present on Moniepoint's official careers page and published Greenhouse board with the location Lagos, Nigeria.",
    providerMetadata: { providerLocation: "Lagos, Nigeria", department: "Site Reliability Engineering" },
  },
  {
    ...common, ...worldwide, ...noSalary,
    sourceExternalId: "Supabase",
    externalId: "5d09daeb-2d7e-42de-9151-81a1341195c4",
    slug: "supabase-cloud-platform-engineer",
    title: "Cloud Platform Engineer",
    specialization: "Cloud governance and internal platforms",
    category: "cloud_engineering",
    employmentType: "full_time",
    experienceLevel: null,
    locationText: "Remote, Global",
    overview: "A globally remote role building cloud governance, reusable infrastructure, security boundaries, and self-service workflows across AWS and Google Cloud.",
    responsibilities: [
      "Design cloud account, identity, access, and governance foundations.",
      "Build reusable Infrastructure as Code and self-service platform capabilities.",
      "Own shared networking, security, and operational primitives.",
    ],
    requirements: [
      "Hands-on experience with AWS or Google Cloud infrastructure.",
      "Strong Infrastructure as Code, IAM, networking, and security knowledge.",
      "Ability to turn ambiguous infrastructure needs into maintainable platform systems.",
    ],
    skills: ["AWS", "Google Cloud", "Infrastructure as Code", "IAM", "Cloud networking", "Platform engineering"],
    applicationUrl: "https://jobs.ashbyhq.com/Supabase/5d09daeb-2d7e-42de-9151-81a1341195c4/application",
    sourceListingUrl: "https://jobs.ashbyhq.com/Supabase/5d09daeb-2d7e-42de-9151-81a1341195c4",
    publishedAt: "2026-10-09T08:36:35.363Z",
    providerUpdatedAt: null,
    verificationEvidence: "Present on Supabase's official careers page and public Ashby job-board API as a listed, globally remote vacancy.",
    providerMetadata: { providerLocation: "Remote, Global", providerEmploymentType: "FullTime", providerWorkplaceType: "Remote" },
  },
  {
    ...common, ...worldwide, ...noSalary,
    sourceExternalId: "Supabase",
    externalId: "9073c0cd-2545-473a-b2ac-63e4615c69b5",
    slug: "supabase-platform-engineer-managed-postgres",
    title: "Platform Engineer, Managed Postgres",
    specialization: "Distributed platform services",
    category: "platform_engineering",
    employmentType: "full_time",
    experienceLevel: "senior",
    locationText: "Remote, Global",
    overview: "A globally remote platform role designing distributed services and data-intensive workflows for Supabase's managed Postgres platform.",
    responsibilities: [
      "Design distributed services and APIs for the Supabase platform.",
      "Improve scalability, reliability, observability, and cost efficiency.",
      "Build event-driven workflows and own service-level objectives.",
    ],
    requirements: [
      "Deep distributed-systems knowledge and production service experience.",
      "Strong TypeScript or Go skills, ideally with at least five years of relevant work.",
      "Experience with cloud infrastructure, containers, and multi-tenant architecture.",
    ],
    skills: ["Distributed systems", "TypeScript", "Go", "AWS", "Containers", "PostgreSQL"],
    applicationUrl: "https://jobs.ashbyhq.com/Supabase/9073c0cd-2545-473a-b2ac-63e4615c69b5/application",
    sourceListingUrl: "https://jobs.ashbyhq.com/Supabase/9073c0cd-2545-473a-b2ac-63e4615c69b5",
    publishedAt: "2026-10-09T17:17:39.437Z",
    providerUpdatedAt: null,
    verificationEvidence: "Present on Supabase's official careers page and public Ashby job-board API as a listed, globally remote vacancy.",
    providerMetadata: { providerLocation: "Remote, Global", providerEmploymentType: "FullTime", providerWorkplaceType: "Remote" },
  },
  {
    ...common, ...worldwide, ...noSalary,
    sourceExternalId: "Supabase",
    externalId: "6c9de03c-e289-4612-9045-492985d0274b",
    slug: "supabase-platform-engineer-edge-networking",
    title: "Platform Engineer, Edge & Networking",
    specialization: "Global edge networking",
    category: "networking",
    employmentType: "full_time",
    experienceLevel: null,
    locationText: "Remote, Global",
    overview: "A globally remote platform role building Supabase's edge routing, DNS, load balancing, and secure traffic-distribution systems.",
    responsibilities: [
      "Build the global edge-router platform and programmable routing controls.",
      "Operate DNS, WAF, TLS, CDN, load-balancing, and network observability systems.",
      "Improve global reliability, latency, deployment safety, and incident response.",
    ],
    requirements: [
      "Production experience with networking or distributed edge infrastructure.",
      "Knowledge of DNS, TLS, load balancing, and cloud networking.",
      "Ability to automate reliable infrastructure and participate in on-call work.",
    ],
    skills: ["DNS", "WAF", "TLS", "CDN", "Load balancing", "Cloud networking", "Observability"],
    applicationUrl: "https://jobs.ashbyhq.com/Supabase/6c9de03c-e289-4612-9045-492985d0274b/application",
    sourceListingUrl: "https://jobs.ashbyhq.com/Supabase/6c9de03c-e289-4612-9045-492985d0274b",
    publishedAt: "2026-09-14T13:27:23.742Z",
    providerUpdatedAt: null,
    verificationEvidence: "Present on Supabase's official careers page and public Ashby job-board API as a listed, globally remote vacancy.",
    providerMetadata: { providerLocation: "Remote, Global", providerEmploymentType: "FullTime", providerWorkplaceType: "Remote" },
  },
  {
    ...common,
    sourceExternalId: "veeva",
    externalId: "47279623-8cbf-42f9-8f41-461c25af2edf",
    slug: "veeva-platform-engineer-commercial-services-tools",
    title: "Platform Engineer — Commercial Services Tools",
    specialization: "Cloud and AI application platform engineering",
    category: "platform_engineering",
    employmentType: "full_time",
    experienceLevel: "mid_level",
    workplaceArrangement: "remote",
    countryCode: "US",
    countryName: "United States",
    region: "Massachusetts",
    city: "Boston",
    locationText: "Remote — Boston, Massachusetts, United States",
    remoteCountries: ["US"],
    remoteRestriction: "The employer listing labels this position Remote US.",
    salaryMin: 90_000,
    salaryMax: 150_000,
    salaryCurrency: "USD",
    salaryPayPeriod: "year",
    overview: "A US-remote platform role shipping cloud and applied-AI services for Veeva's commercial-services tooling.",
    responsibilities: [
      "Build production AI features and asynchronous Python services on AWS.",
      "Deliver backend and React/TypeScript features with tests and observability.",
      "Own features from design through deployment and operation.",
    ],
    requirements: [
      "At least two years of production software-delivery experience.",
      "Strong Python API development plus practical React or TypeScript experience.",
      "Foundational AWS, containers, PostgreSQL, and Git workflow knowledge.",
    ],
    skills: ["AWS", "Python", "FastAPI", "React", "TypeScript", "PostgreSQL", "Applied AI"],
    certifications: [],
    applicationUrl: "https://jobs.lever.co/veeva/47279623-8cbf-42f9-8f41-461c25af2edf/apply",
    sourceListingUrl: "https://jobs.lever.co/veeva/47279623-8cbf-42f9-8f41-461c25af2edf",
    publishedAt: null,
    applicationDeadline: null,
    providerUpdatedAt: null,
    status: "open",
    structuredDataEligible: false,
    verificationEvidence: "Present on Veeva's official careers site and exact public Lever posting; the employer listing states Remote US and discloses the salary range.",
    providerMetadata: { providerLocation: "Massachusetts - Boston", providerEmploymentType: "Full-Time", providerWorkplaceType: "remote" },
  },
] as const satisfies readonly InitialJob[];
