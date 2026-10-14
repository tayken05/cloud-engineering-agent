import "server-only";

import { and, asc, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import type { SourceFilters } from "@/features/sources/source-filters";
import { createDatabase } from "@/server/db/client";
import { sources } from "@/server/db/schema";

export const SOURCE_QUERY_LIMIT = 100;

export type SourceCatalogRecord = Readonly<{
  canonicalUrl: string;
  description: string | null;
  isActive: boolean;
  key: string;
  kind: (typeof sources.kind.enumValues)[number];
  name: string;
  primaryTopic: (typeof sources.primaryTopic.enumValues)[number] | null;
}>;

export class SourceCatalogQueryError extends Error {
  constructor() {
    super("The source catalog could not be loaded.");
    this.name = "SourceCatalogQueryError";
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function listSources(
  filters: SourceFilters,
  options: Readonly<{ signal?: AbortSignal }> = {},
): Promise<readonly SourceCatalogRecord[]> {
  const conditions: SQL[] = [];
  if (filters.kind) conditions.push(eq(sources.kind, filters.kind));
  if (filters.topic) conditions.push(eq(sources.primaryTopic, filters.topic));
  if (filters.status !== "all") {
    conditions.push(eq(sources.isActive, filters.status === "active"));
  }
  if (filters.query) {
    const pattern = `%${escapeLikePattern(filters.query)}%`;
    const search = or(
      ilike(sources.name, pattern),
      ilike(sources.description, pattern),
    );
    if (search) conditions.push(search);
  }

  try {
    return await createDatabase(options)
      .select({
        canonicalUrl: sources.canonicalUrl,
        description: sources.description,
        isActive: sources.isActive,
        key: sources.key,
        kind: sources.kind,
        name: sources.name,
        primaryTopic: sources.primaryTopic,
      })
      .from(sources)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(sources.primaryTopic), desc(sources.priority), asc(sources.name))
      .limit(SOURCE_QUERY_LIMIT);
  } catch {
    throw new SourceCatalogQueryError();
  }
}
