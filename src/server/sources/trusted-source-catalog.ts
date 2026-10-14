import type { NewSource } from "@/server/db/schema";

export type TrustedSourceCatalogEntry = Readonly<
  Pick<
    NewSource,
    "canonicalUrl" | "description" | "key" | "kind" | "name" | "primaryTopic"
  >
>;

export const TRUSTED_SOURCE_CATALOG = [
  {
    key: "aws-architecture-blog",
    name: "AWS Architecture Blog",
    canonicalUrl: "https://aws.amazon.com/blogs/architecture/",
    kind: "publisher",
    primaryTopic: "cloud_engineering",
    description: "Official AWS architecture guidance, design patterns, and technical implementation articles.",
  },
  {
    key: "microsoft-azure-blog",
    name: "Microsoft Azure Blog",
    canonicalUrl: "https://azure.microsoft.com/en-us/blog/",
    kind: "publisher",
    primaryTopic: "cloud_engineering",
    description: "Official Azure product announcements, engineering guidance, and cloud platform updates.",
  },
  {
    key: "google-cloud-blog",
    name: "Google Cloud Blog",
    canonicalUrl: "https://cloud.google.com/blog/",
    kind: "publisher",
    primaryTopic: "cloud_engineering",
    description: "Official Google Cloud product news, architecture guidance, and engineering articles.",
  },
  {
    key: "linux-kernel-archives",
    name: "Linux Kernel Archives",
    canonicalUrl: "https://www.kernel.org/",
    kind: "engineering_organization",
    primaryTopic: "linux",
    description: "Official Linux kernel release listings and project resources maintained by the Linux Kernel Organization.",
  },
  {
    key: "cloudflare-blog",
    name: "Cloudflare Blog",
    canonicalUrl: "https://blog.cloudflare.com/",
    kind: "publisher",
    primaryTopic: "networking",
    description: "Cloudflare engineering articles about internet infrastructure, networking, performance, and security.",
  },
  {
    key: "kubernetes-blog",
    name: "Kubernetes Blog",
    canonicalUrl: "https://kubernetes.io/blog/",
    kind: "engineering_organization",
    primaryTopic: "containers_kubernetes",
    description: "Official Kubernetes project announcements, release coverage, and technical guidance.",
  },
  {
    key: "cncf-blog",
    name: "Cloud Native Computing Foundation Blog",
    canonicalUrl: "https://www.cncf.io/blog/",
    kind: "engineering_organization",
    primaryTopic: "devops",
    description: "Cloud-native ecosystem and project updates published by the Cloud Native Computing Foundation.",
  },
  {
    key: "hashicorp-blog",
    name: "HashiCorp Blog",
    canonicalUrl: "https://www.hashicorp.com/en/blog",
    kind: "publisher",
    primaryTopic: "infrastructure_as_code",
    description: "Official infrastructure automation, Terraform, platform engineering, and security product updates.",
  },
  {
    key: "nist-cybersecurity-insights",
    name: "NIST Cybersecurity Insights",
    canonicalUrl: "https://www.nist.gov/blogs/cybersecurity-insights",
    kind: "engineering_organization",
    primaryTopic: "cybersecurity",
    description: "The official NIST blog covering its cybersecurity and privacy work, guidance, and resources.",
  },
  {
    key: "github-engineering",
    name: "GitHub Engineering",
    canonicalUrl: "https://github.blog/engineering/",
    kind: "publisher",
    primaryTopic: "software_engineering",
    description: "First-party engineering articles about GitHub architecture, infrastructure, performance, and platform security.",
  },
  {
    key: "nvidia-technical-blog",
    name: "NVIDIA Technical Blog",
    canonicalUrl: "https://developer.nvidia.com/blog/",
    kind: "publisher",
    primaryTopic: "ai_infrastructure",
    description: "NVIDIA technical articles about accelerated computing, AI engineering, inference, and data-center infrastructure.",
  },
  {
    key: "cisco-security-advisories",
    name: "Cisco Security Advisories",
    canonicalUrl: "https://sec.cloudapps.cisco.com/security/center/publicationListing.x",
    kind: "official_feed",
    primaryTopic: "cybersecurity",
    description: "Official Cisco PSIRT advisories for vulnerabilities affecting Cisco products and networks.",
  },
] as const satisfies readonly TrustedSourceCatalogEntry[];
