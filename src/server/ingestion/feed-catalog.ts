import type { SourceTopic } from "@/features/sources/source-filters";

export type FeedSourceConfig = Readonly<{
  allowedArticleHosts: readonly string[];
  allowedFeedHosts: readonly string[];
  articleLinkPolicy?: "linux_kernel_changelog";
  feedUrl: string;
  maxItems: number;
  sourceKey: string;
  topic: SourceTopic;
}>;

export const VERIFIED_FEEDS = [
  {
    sourceKey: "aws-architecture-blog",
    feedUrl: "https://aws.amazon.com/blogs/architecture/feed/",
    allowedFeedHosts: ["aws.amazon.com"],
    allowedArticleHosts: ["aws.amazon.com"],
    maxItems: 20,
    topic: "cloud_engineering",
  },
  {
    sourceKey: "google-cloud-blog",
    feedUrl: "https://cloudblog.withgoogle.com/rss/",
    allowedFeedHosts: ["cloudblog.withgoogle.com"],
    allowedArticleHosts: ["cloud.google.com"],
    maxItems: 20,
    topic: "cloud_engineering",
  },
  {
    sourceKey: "cloudflare-blog",
    feedUrl: "https://blog.cloudflare.com/rss/",
    allowedFeedHosts: ["blog.cloudflare.com"],
    allowedArticleHosts: ["blog.cloudflare.com"],
    maxItems: 20,
    topic: "networking",
  },
  {
    sourceKey: "kubernetes-blog",
    feedUrl: "https://kubernetes.io/feed.xml",
    allowedFeedHosts: ["kubernetes.io"],
    allowedArticleHosts: ["kubernetes.io"],
    maxItems: 20,
    topic: "containers_kubernetes",
  },
  {
    sourceKey: "cncf-blog",
    feedUrl: "https://www.cncf.io/feed/",
    allowedFeedHosts: ["www.cncf.io"],
    allowedArticleHosts: ["www.cncf.io"],
    maxItems: 20,
    topic: "devops",
  },
  {
    sourceKey: "hashicorp-blog",
    feedUrl: "https://www.hashicorp.com/blog/feed.xml",
    allowedFeedHosts: ["www.hashicorp.com"],
    allowedArticleHosts: ["www.hashicorp.com"],
    maxItems: 20,
    topic: "infrastructure_as_code",
  },
  {
    sourceKey: "microsoft-azure-blog",
    feedUrl: "https://azure.microsoft.com/en-us/blog/feed/",
    allowedFeedHosts: ["azure.microsoft.com"],
    allowedArticleHosts: [
      "azure.microsoft.com",
      "www.microsoft.com",
      "techcommunity.microsoft.com",
    ],
    maxItems: 15,
    topic: "cloud_engineering",
  },
  {
    sourceKey: "linux-kernel-archives",
    feedUrl: "https://www.kernel.org/feeds/kdist.xml",
    allowedFeedHosts: ["www.kernel.org"],
    allowedArticleHosts: ["cdn.kernel.org"],
    articleLinkPolicy: "linux_kernel_changelog",
    maxItems: 10,
    topic: "linux",
  },
  {
    sourceKey: "cisco-security-advisories",
    feedUrl: "https://sec.cloudapps.cisco.com/security/center/psirtrss20/CiscoSecurityAdvisory.xml",
    allowedFeedHosts: ["sec.cloudapps.cisco.com"],
    allowedArticleHosts: ["sec.cloudapps.cisco.com"],
    maxItems: 15,
    topic: "cybersecurity",
  },
  {
    sourceKey: "github-engineering",
    feedUrl: "https://github.blog/engineering/feed/",
    allowedFeedHosts: ["github.blog"],
    allowedArticleHosts: ["github.blog"],
    maxItems: 15,
    topic: "software_engineering",
  },
  {
    sourceKey: "nist-cybersecurity-insights",
    feedUrl: "https://www.nist.gov/blogs/cybersecurity-insights/rss.xml",
    allowedFeedHosts: ["www.nist.gov"],
    allowedArticleHosts: ["www.nist.gov"],
    maxItems: 15,
    topic: "cybersecurity",
  },
  {
    sourceKey: "nvidia-technical-blog",
    feedUrl: "https://developer.nvidia.com/blog/feed/",
    allowedFeedHosts: ["developer.nvidia.com"],
    allowedArticleHosts: ["developer.nvidia.com"],
    maxItems: 15,
    topic: "ai_infrastructure",
  },
] as const satisfies readonly FeedSourceConfig[];
