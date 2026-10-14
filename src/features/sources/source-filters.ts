export const SOURCE_TOPIC_VALUES = [
  "cloud_engineering",
  "software_engineering",
  "linux",
  "networking",
  "devops",
  "cybersecurity",
  "artificial_intelligence",
  "developer_tools",
  "open_source",
  "technology_communities",
  "containers_kubernetes",
  "infrastructure_as_code",
  "ai_infrastructure",
  "engineering_careers",
] as const;

export const SOURCE_KIND_VALUES = [
  "official_feed",
  "publisher",
  "engineering_organization",
  "community",
] as const;

export const SOURCE_STATUS_VALUES = ["all", "active", "inactive"] as const;

export type SourceTopic = (typeof SOURCE_TOPIC_VALUES)[number];
export type SourceKind = (typeof SOURCE_KIND_VALUES)[number];
export type SourceStatus = (typeof SOURCE_STATUS_VALUES)[number];

export type SourceFilters = Readonly<{
  kind?: SourceKind;
  query?: string;
  status: SourceStatus;
  topic?: SourceTopic;
}>;

export type SourceSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

const MAX_SEARCH_LENGTH = 100;

function first(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function isMember<const T extends readonly string[]>(
  values: T,
  value: string | undefined,
): value is T[number] {
  return value !== undefined && values.includes(value);
}

export function parseSourceFilters(searchParams: SourceSearchParams): SourceFilters {
  const query = first(searchParams.q)?.trim().slice(0, MAX_SEARCH_LENGTH);
  const kindValue = first(searchParams.kind);
  const topicValue = first(searchParams.topic);
  const statusValue = first(searchParams.status);

  return {
    ...(isMember(SOURCE_KIND_VALUES, kindValue) ? { kind: kindValue } : {}),
    ...(query ? { query } : {}),
    status: isMember(SOURCE_STATUS_VALUES, statusValue) ? statusValue : "all",
    ...(isMember(SOURCE_TOPIC_VALUES, topicValue) ? { topic: topicValue } : {}),
  };
}

export function formatSourceLabel(value: string): string {
  const preferredLabels: Readonly<Record<string, string>> = {
    ai_infrastructure: "AI Infrastructure",
    containers_kubernetes: "Containers & Kubernetes",
    devops: "DevOps",
    infrastructure_as_code: "Infrastructure as Code",
  };
  if (preferredLabels[value]) return preferredLabels[value];

  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
