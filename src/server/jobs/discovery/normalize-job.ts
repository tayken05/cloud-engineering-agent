import { createHash } from "node:crypto";

import type { EmployerBoard, ProviderJob } from "./types.ts";

export type JobCategory = "cloud_engineering" | "devops_infrastructure" | "devsecops" | "networking" |
  "cybersecurity" | "linux" | "site_reliability" | "platform_engineering" | "software_engineering" | "ai_engineering";

export type NormalizedJob = Readonly<{
  applicationUrl: string;
  category: JobCategory;
  contentHash: string;
  countryCode: string | null;
  countryName: string | null;
  employmentType: "full_time" | "part_time" | "contract" | "temporary" | "internship" | null;
  experienceLevel: "entry_level" | "junior" | "mid_level" | "senior" | "lead" | "manager" | "executive" | null;
  externalId: string;
  locationText: string;
  overview: string;
  providerMetadata: Readonly<Record<string, string | boolean | number | null>>;
  providerUpdatedAt: Date | null;
  publishedAt: Date | null;
  remoteCountries: readonly string[] | null;
  remoteRestriction: string | null;
  skills: readonly string[];
  slug: string;
  sourceListingUrl: string;
  specialization: string;
  title: string;
  verificationEvidence: string;
  workplaceArrangement: "remote" | "hybrid" | "onsite" | null;
}>;

const technicalRole = /\b(engineer(?:ing)?|architect|administrator|developer|site reliability|sre|devops|devsecops|security analyst|security specialist|technical support)\b/i;
const technicalDomain = /\b(cloud|aws|azure|google cloud|gcp|platform|site reliability|sre|devops|devsecops|linux|ubuntu|kernel|network|infrastructure|security|cyber|kubernetes|container|terraform|observability|systems?|database|postgres|deployment|reliability)\b/i;
const excluded = /\b(account executive|sales|business development|marketing|recruiter|talent acquisition|finance|legal|product manager|product marketing|customer success manager)\b/i;

const countries: readonly [RegExp, string, string][] = [
  [/\bnigeria\b/i, "NG", "Nigeria"], [/\bunited states\b|\busa\b|\bus only\b/i, "US", "United States"],
  [/\bcanada\b/i, "CA", "Canada"], [/\bunited kingdom\b|\buk\b/i, "GB", "United Kingdom"],
  [/\bpoland\b/i, "PL", "Poland"], [/\baustralia\b/i, "AU", "Australia"], [/\bindia\b/i, "IN", "India"],
  [/\bgermany\b/i, "DE", "Germany"], [/\bireland\b/i, "IE", "Ireland"], [/\bspain\b/i, "ES", "Spain"],
  [/\bsweden\b/i, "SE", "Sweden"], [/\bfrance\b/i, "FR", "France"], [/\bnetherlands\b/i, "NL", "Netherlands"],
  [/\bsingapore\b/i, "SG", "Singapore"], [/\bjapan\b/i, "JP", "Japan"], [/\bisrael\b/i, "IL", "Israel"],
];

export function isRelevantEngineeringJob(job: ProviderJob): boolean {
  const text = `${job.title} ${job.description}`;
  return !excluded.test(job.title) && technicalRole.test(job.title) && technicalDomain.test(text);
}

function classify(title: string, text: string): Readonly<{ category: JobCategory; specialization: string }> {
  if (/\bsite reliability|\bsre\b|reliability engineer/i.test(title)) return { category: "site_reliability", specialization: "Site reliability engineering" };
  if (/\bplatform/i.test(title)) return { category: "platform_engineering", specialization: "Platform engineering" };
  if (/\bnetwork/i.test(title)) return { category: "networking", specialization: "Networking" };
  if (/\blinux|ubuntu|kernel|systems administrator/i.test(title)) return { category: "linux", specialization: "Linux and systems engineering" };
  if (/\bdevsecops\b/i.test(text)) return { category: "devsecops", specialization: "DevSecOps" };
  if (/\bcyber|security\b/i.test(text)) return { category: "cybersecurity", specialization: "Cloud and application security" };
  if (/\bsite reliability|\bsre\b|reliability engineer/i.test(text)) return { category: "site_reliability", specialization: "Site reliability engineering" };
  if (/\bnetwork/i.test(text)) return { category: "networking", specialization: "Networking" };
  if (/\blinux|ubuntu|kernel|systems administrator/i.test(text)) return { category: "linux", specialization: "Linux and systems engineering" };
  if (/\bplatform/i.test(text)) return { category: "platform_engineering", specialization: "Platform engineering" };
  if (/\bdevops|gitops|kubernetes|container|terraform|infrastructure/i.test(text)) return { category: "devops_infrastructure", specialization: "DevOps and infrastructure" };
  if (/\bai|machine learning|ml infrastructure/i.test(text)) return { category: "ai_engineering", specialization: "AI engineering infrastructure" };
  if (/\bcloud|aws|azure|gcp|google cloud/i.test(text)) return { category: "cloud_engineering", specialization: "Cloud engineering" };
  return { category: "software_engineering", specialization: "Software engineering" };
}

function experience(title: string): NormalizedJob["experienceLevel"] {
  if (/\bchief|\bvp\b|vice president|director/i.test(title)) return "executive";
  if (/\bmanager|head of/i.test(title)) return "manager";
  if (/\bprincipal|staff|lead/i.test(title)) return "lead";
  if (/\bsenior|\bsr\.?\b/i.test(title)) return "senior";
  if (/\bjunior|\bjr\.?\b/i.test(title)) return "junior";
  if (/\bgraduate|entry.level|associate/i.test(title)) return "entry_level";
  return null;
}

function employment(value: string | null, title: string): NormalizedJob["employmentType"] {
  const text = `${value ?? ""} ${title}`;
  if (/intern/i.test(text)) return "internship";
  if (/part.?time/i.test(text)) return "part_time";
  if (/contract/i.test(text)) return "contract";
  if (/temporary/i.test(text)) return "temporary";
  if (/full.?time/i.test(text)) return "full_time";
  return null;
}

function geography(location: string, workplace: string | null) {
  const matched = countries.filter(([pattern]) => pattern.test(location));
  const unique = [...new Map(matched.map(([, code, name]) => [code, { code, name }])).values()];
  const remote = /remote|home.?based|telecommute/i.test(`${location} ${workplace ?? ""}`);
  const hybrid = /hybrid/i.test(`${location} ${workplace ?? ""}`);
  const worldwide = /worldwide|global/i.test(location);
  return {
    countryCode: unique.length === 1 ? unique[0]?.code ?? null : null,
    countryName: unique.length === 1 ? unique[0]?.name ?? null : null,
    remoteCountries: remote && !worldwide && unique.length > 0 ? unique.map((item) => item.code) : null,
    remoteRestriction: remote ? (worldwide ? "Worldwide" : `Employer listing location: ${location}`) : null,
    workplaceArrangement: hybrid ? "hybrid" as const : remote ? "remote" as const : workplace ? "onsite" as const : null,
  };
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 135);
}

function skills(text: string): readonly string[] {
  const map: readonly [RegExp, string][] = [
    [/\baws\b/i, "AWS"], [/\bazure\b/i, "Azure"], [/\bgoogle cloud|\bgcp\b/i, "Google Cloud"],
    [/\bkubernetes|\bk8s\b/i, "Kubernetes"], [/\bterraform\b/i, "Terraform"], [/\blinux|ubuntu/i, "Linux"],
    [/\bpython\b/i, "Python"], [/\bgolang|\bgo\b/i, "Go"], [/\bsecurity\b/i, "Security"],
    [/\bnetwork/i, "Networking"], [/\bobservability|prometheus|grafana/i, "Observability"], [/\bpostgres/i, "PostgreSQL"],
  ];
  return map.flatMap(([pattern, name]) => pattern.test(text) ? [name] : []).slice(0, 12);
}

export function normalizeProviderJob(board: EmployerBoard, job: ProviderJob): NormalizedJob {
  const text = `${job.title} ${job.description}`;
  const classification = classify(job.title, text);
  const place = geography(job.location, job.workplaceType);
  const shortId = createHash("sha256").update(job.externalId).digest("hex").slice(0, 10);
  const overview = job.description
    ? job.description.slice(0, 700).replace(/\s+\S*$/, "").trim()
    : `Official ${board.employerName} listing for ${job.title}.`;
  const normalized = {
    applicationUrl: job.applicationUrl, category: classification.category,
    countryCode: place.countryCode, countryName: place.countryName,
    employmentType: employment(job.employmentType, job.title), experienceLevel: experience(job.title), externalId: job.externalId,
    locationText: job.location, overview: overview || `Official ${board.employerName} listing for ${job.title}.`,
    providerMetadata: { automatedDiscovery: true, provider: board.provider, providerLocation: job.location, providerWorkplace: job.workplaceType },
    providerUpdatedAt: job.providerUpdatedAt, publishedAt: job.publishedAt,
    remoteCountries: place.remoteCountries, remoteRestriction: place.remoteRestriction,
    skills: skills(text), slug: `${board.employerSlug}-${slugify(job.title)}-${shortId}`,
    sourceListingUrl: job.sourceListingUrl, specialization: classification.specialization, title: job.title,
    verificationEvidence: `Present on ${board.employerName}'s verified official ${board.provider} recruiting board at the recorded verification time.`,
    workplaceArrangement: place.workplaceArrangement,
  } as const;
  const contentHash = createHash("sha256").update(JSON.stringify(normalized, (_key, value) => value instanceof Date ? value.toISOString() : value)).digest("hex");
  return Object.freeze({ ...normalized, contentHash });
}
