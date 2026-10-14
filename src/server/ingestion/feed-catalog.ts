import type { SourceTopic } from "@/features/sources/source-filters";

export type FeedSourceConfig = Readonly<{
  allowedArticleHosts: readonly string[];
  allowedFeedHosts: readonly string[];
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
] as const satisfies readonly FeedSourceConfig[];
