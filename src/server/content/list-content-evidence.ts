import "server-only";

import { desc, eq } from "drizzle-orm";

import type { EvidenceOption } from "@/features/content-studio/content-types";
import { createDatabase } from "@/server/db/client";
import { sourceItems, sources } from "@/server/db/schema";

export const CONTENT_EVIDENCE_LIMIT = 40;

export class ContentEvidenceQueryError extends Error {
  constructor() {
    super("Publisher evidence could not be loaded.");
    this.name = "ContentEvidenceQueryError";
  }
}

export async function listContentEvidence(
  options: Readonly<{ signal?: AbortSignal }> = {},
): Promise<readonly EvidenceOption[]> {
  try {
    const rows = await createDatabase(options)
      .select({
        id: sourceItems.id,
        publisher: sources.name,
        publishedAt: sourceItems.publishedAt,
        title: sourceItems.title,
        url: sourceItems.originalUrl,
      })
      .from(sourceItems)
      .innerJoin(sources, eq(sourceItems.sourceId, sources.id))
      .orderBy(desc(sourceItems.publishedAt), desc(sourceItems.collectedAt))
      .limit(CONTENT_EVIDENCE_LIMIT);

    return rows.map((row) => ({
      id: row.id,
      publisher: row.publisher,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      title: row.title,
      url: row.url,
      verificationLabel: "publisher_record" as const,
    }));
  } catch {
    throw new ContentEvidenceQueryError();
  }
}
