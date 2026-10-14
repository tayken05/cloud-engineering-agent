import { SOURCE_TOPIC_VALUES, type SourceTopic } from "@/features/sources/source-filters";

export type NewsFilters = Readonly<{
  source?: string;
  topic?: SourceTopic;
}>;

export type NewsSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

function first(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export function parseNewsFilters(searchParams: NewsSearchParams): NewsFilters {
  const source = first(searchParams.source)?.trim().slice(0, 128);
  const topic = first(searchParams.topic);
  return {
    ...(source && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source) ? { source } : {}),
    ...(topic && SOURCE_TOPIC_VALUES.includes(topic as SourceTopic)
      ? { topic: topic as SourceTopic }
      : {}),
  };
}
