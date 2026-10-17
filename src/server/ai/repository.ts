import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { AiGenerationError, type AiCreativeMemory, type AiIdeaSuggestion, type AiRunStore, type AiVerificationStatus } from "@/features/ai-content/types";
import { selectVariedEvidence } from "@/features/ai-content/evidence-selection";
import {
  aiContentSuggestions,
  aiGenerationEvidence,
  aiGenerationRuns,
  contentDraftRevisions,
  contentDrafts,
  contentIdeas,
  sourceItems,
  sources,
} from "@/server/db/schema";
import { withDatabaseTransaction } from "@/server/db/transaction";

// An image-first package can use one bounded image request, one visual inspection,
// and one grounded text request. Keep the database lease longer than that total
// while still allowing an interrupted serverless invocation to recover.
const RUN_LEASE_MS = 360_000;

export type AiSuggestionView = Readonly<{
  createdAt: string;
  editorialFeedback: string | null;
  editorialStatus: "proposed" | "accepted" | "rejected";
  id: string;
  payload: AiIdeaSuggestion;
  verificationStatus: AiVerificationStatus;
}>;

export class PostgresAiRunStore implements AiRunStore {
  async begin(input: Parameters<AiRunStore["begin"]>[0]) {
    return withDatabaseTransaction(async (tx) => {
      const now = new Date();
      await tx.update(aiGenerationRuns).set({
        errorCode: "lease_expired",
        finishedAt: now,
        reservedCostMicrousd: 0,
        status: "failed",
        updatedAt: now,
      }).where(and(
        eq(aiGenerationRuns.ownerId, input.ownerId),
        eq(aiGenerationRuns.status, "running"),
        sql`${aiGenerationRuns.leaseExpiresAt} <= ${now}`,
      ));
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ai-generation:${input.ownerId}`}))`);
      const existing = await tx.select({ fingerprint: aiGenerationRuns.requestFingerprint, id: aiGenerationRuns.id })
        .from(aiGenerationRuns)
        .where(and(eq(aiGenerationRuns.ownerId, input.ownerId), eq(aiGenerationRuns.idempotencyKey, input.idempotencyKey)))
        .limit(1);
      if (existing[0]) {
        if (existing[0].fingerprint !== input.fingerprint) throw new AiGenerationError("invalid_request", "The idempotency key was already used for a different request.");
        return { duplicate: true, runId: existing[0].id };
      }
      const active = await tx.select({ id: aiGenerationRuns.id }).from(aiGenerationRuns)
        .where(and(eq(aiGenerationRuns.ownerId, input.ownerId), eq(aiGenerationRuns.status, "running"))).limit(1);
      if (active[0]) throw new AiGenerationError("already_running", "Another AI generation request is already running.");
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const usage = await tx.select({
        total: sql<number>`coalesce(sum(case when ${aiGenerationRuns.status} = 'running' then ${aiGenerationRuns.reservedCostMicrousd} else coalesce(${aiGenerationRuns.estimatedCostMicrousd}, 0) end), 0)::bigint`,
      }).from(aiGenerationRuns).where(and(eq(aiGenerationRuns.ownerId, input.ownerId), gte(aiGenerationRuns.startedAt, monthStart)));
      const committed = Number(usage[0]?.total ?? 0);
      if (input.monthlyBudgetMicrousd <= 0 || committed + input.reservationMicrousd > input.monthlyBudgetMicrousd) {
        throw new AiGenerationError("budget_exhausted", "The configured monthly AI spending allowance is unavailable or exhausted.");
      }
      const inserted = await tx.insert(aiGenerationRuns).values({
        idempotencyKey: input.idempotencyKey,
        kind: input.kind,
        leaseExpiresAt: new Date(now.getTime() + RUN_LEASE_MS),
        model: input.model,
        ownerId: input.ownerId,
        provider: input.provider,
        requestFingerprint: input.fingerprint,
        requestedCount: input.requestedCount,
        reservedCostMicrousd: input.reservationMicrousd,
      }).returning({ id: aiGenerationRuns.id });
      const runId = inserted[0]?.id;
      if (!runId) throw new AiGenerationError("provider_failure", "The AI generation run could not be reserved.");
      if (input.evidenceIds.length > 0) await tx.insert(aiGenerationEvidence).values([...new Set(input.evidenceIds)].map((sourceItemId) => ({ ownerId: input.ownerId, runId, sourceItemId })));
      return { duplicate: false, runId };
    });
  }

  async complete(input: Parameters<AiRunStore["complete"]>[0]) {
    await withDatabaseTransaction(async (tx) => {
      const now = new Date();
      const updated = await tx.update(aiGenerationRuns).set({
        estimatedCostMicrousd: input.estimatedCostMicrousd,
        finishedAt: now,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        providerResponseId: input.responseId,
        reservedCostMicrousd: 0,
        status: "succeeded",
        updatedAt: now,
      }).where(and(eq(aiGenerationRuns.id, input.runId), eq(aiGenerationRuns.ownerId, input.ownerId), eq(aiGenerationRuns.status, "running"))).returning({ id: aiGenerationRuns.id });
      if (!updated[0]) throw new AiGenerationError("provider_failure", "The AI generation run could not be completed safely.");
      if (input.suggestions.length > 0) await tx.insert(aiContentSuggestions).values(input.suggestions.map((suggestion, ordinal) => ({
        kind: suggestion.kind,
        ordinal,
        ownerId: input.ownerId,
        payload: suggestion.payload,
        runId: input.runId,
        verificationStatus: suggestion.verificationStatus,
      })));
    });
  }

  async fail(input: Parameters<AiRunStore["fail"]>[0]) {
    await withDatabaseTransaction(async (tx) => {
      const now = new Date();
      await tx.update(aiGenerationRuns).set({ errorCode: input.errorCode.slice(0, 128), finishedAt: now, reservedCostMicrousd: 0, status: "failed", updatedAt: now })
        .where(and(eq(aiGenerationRuns.id, input.runId), eq(aiGenerationRuns.ownerId, input.ownerId), eq(aiGenerationRuns.status, "running")));
    });
  }
}

export async function getAiMonthlyCommittedMicrousd(ownerId: string, now = new Date()): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const usage = await withDatabaseTransaction((db) => db.select({
    total: sql<number>`coalesce(sum(case
      when ${aiGenerationRuns.status} = 'running' and ${aiGenerationRuns.leaseExpiresAt} > ${now}
        then ${aiGenerationRuns.reservedCostMicrousd}
      when ${aiGenerationRuns.status} = 'succeeded'
        then coalesce(${aiGenerationRuns.estimatedCostMicrousd}, 0)
      else 0
    end), 0)::bigint`,
  }).from(aiGenerationRuns).where(and(
    eq(aiGenerationRuns.ownerId, ownerId),
    gte(aiGenerationRuns.startedAt, monthStart),
  )));
  return Number(usage[0]?.total ?? 0);
}

export async function listAiIdeaSuggestions(ownerId: string): Promise<readonly AiSuggestionView[]> {
  const rows = await withDatabaseTransaction((db) => db.select({
    createdAt: aiContentSuggestions.createdAt,
    editorialFeedback: aiContentSuggestions.editorialFeedback,
    editorialStatus: aiContentSuggestions.editorialStatus,
    id: aiContentSuggestions.id,
    payload: aiContentSuggestions.payload,
    verificationStatus: aiContentSuggestions.verificationStatus,
  }).from(aiContentSuggestions).where(and(eq(aiContentSuggestions.ownerId, ownerId), eq(aiContentSuggestions.kind, "idea_batch"))).orderBy(desc(aiContentSuggestions.createdAt)).limit(50));
  return rows.flatMap((row) => {
    const payload = row.payload as unknown as AiIdeaSuggestion;
    return payload && typeof payload.title === "string" ? [{ ...row, createdAt: row.createdAt.toISOString(), payload }] : [];
  });
}

export async function getAiSuggestion(ownerId: string, suggestionId: string) {
  const rows = await withDatabaseTransaction((db) => db.select().from(aiContentSuggestions)
    .where(and(eq(aiContentSuggestions.id, suggestionId), eq(aiContentSuggestions.ownerId, ownerId))).limit(1));
  return rows[0] ?? null;
}

export async function getAiRunSuggestion(ownerId: string, runId: string) {
  const rows = await withDatabaseTransaction((db) => db.select().from(aiContentSuggestions)
    .where(and(eq(aiContentSuggestions.runId, runId), eq(aiContentSuggestions.ownerId, ownerId))).orderBy(aiContentSuggestions.ordinal).limit(1));
  return rows[0] ?? null;
}

export async function setAiSuggestionDecision(input: Readonly<{
  acceptedDraftId?: string;
  acceptedIdeaId?: string;
  feedback?: string;
  ownerId: string;
  status: "accepted" | "rejected";
  suggestionId: string;
}>): Promise<void> {
  await withDatabaseTransaction(async (tx) => {
    const updated = await tx.update(aiContentSuggestions).set({
      acceptedDraftId: input.acceptedDraftId ?? null,
      acceptedIdeaId: input.acceptedIdeaId ?? null,
      editorialFeedback: input.feedback?.trim().slice(0, 2000) || null,
      editorialStatus: input.status,
      updatedAt: new Date(),
    }).where(and(eq(aiContentSuggestions.id, input.suggestionId), eq(aiContentSuggestions.ownerId, input.ownerId), eq(aiContentSuggestions.editorialStatus, "proposed"))).returning({ id: aiContentSuggestions.id });
    if (!updated[0]) throw new Error("The suggestion is unavailable or was already reviewed.");
  });
}

export async function listExistingContentSubjects(ownerId: string): Promise<readonly string[]> {
  return withDatabaseTransaction(async (db) => {
    const ideas = await db.select({ value: contentIdeas.subject }).from(contentIdeas).where(eq(contentIdeas.ownerId, ownerId)).limit(100);
    const drafts = await db.select({ caption: contentDrafts.caption, threadPosts: contentDrafts.threadPosts, title: contentDrafts.title })
      .from(contentDrafts).where(eq(contentDrafts.ownerId, ownerId)).limit(100);
    return [
      ...ideas.map((item) => item.value),
      ...drafts.map((item) => `${item.title} ${item.caption} ${item.threadPosts.join(" ")}`.trim()),
    ].filter(Boolean);
  });
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function noteLine(value: string, label: string): string {
  const line = value.split("\n").find((entry) => entry.startsWith(label));
  return line?.slice(label.length).trim() ?? "";
}

export async function listCreativeMemory(ownerId: string, limit = 30): Promise<readonly AiCreativeMemory[]> {
  const safeLimit = Math.min(30, Math.max(1, limit));
  return withDatabaseTransaction(async (db) => {
    const drafts = await db.select({
      caption: contentDrafts.caption,
      formatId: contentDrafts.formatId,
      id: contentDrafts.id,
      imagePrompt: contentDrafts.imagePrompt,
      mediaPath: contentDrafts.mediaPath,
      moderatorNotes: contentDrafts.moderatorNotes,
      notes: contentIdeas.notes,
      status: contentDrafts.status,
      subject: contentIdeas.subject,
      threadPosts: contentDrafts.threadPosts,
      title: contentDrafts.title,
      updatedAt: contentDrafts.updatedAt,
    }).from(contentDrafts).leftJoin(contentIdeas, and(eq(contentDrafts.ideaId, contentIdeas.id), eq(contentDrafts.ownerId, contentIdeas.ownerId)))
      .where(eq(contentDrafts.ownerId, ownerId)).orderBy(desc(contentDrafts.updatedAt)).limit(safeLimit);
    const suggestions = await db.select({
      acceptedDraftId: aiContentSuggestions.acceptedDraftId,
      editorialFeedback: aiContentSuggestions.editorialFeedback,
      payload: aiContentSuggestions.payload,
    }).from(aiContentSuggestions).where(eq(aiContentSuggestions.ownerId, ownerId)).orderBy(desc(aiContentSuggestions.updatedAt)).limit(60);
    const suggestionByDraft = new Map(suggestions.filter((item) => item.acceptedDraftId).map((item) => [item.acceptedDraftId!, item]));
    const current: AiCreativeMemory[] = drafts.map((draft) => {
      const suggestion = suggestionByDraft.get(draft.id);
      const payload = jsonRecord(suggestion?.payload);
      const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
      const selectedIndex = typeof payload?.selectedCandidateIndex === "number" ? Math.floor(payload.selectedCandidateIndex) : -1;
      const selected = jsonRecord(candidates[selectedIndex]);
      const rejection = noteLine(draft.moderatorNotes, "Editorial rejection:");
      return {
        approach: text(selected?.creativeApproach, 240) || noteLine(draft.notes ?? "", "Angle:"),
        feedback: rejection || text(suggestion?.editorialFeedback, 500),
        formatId: draft.formatId,
        hook: (draft.threadPosts.find((post) => post.trim()) ?? draft.caption).slice(0, 280),
        mediaPath: draft.mediaPath,
        premise: text(selected?.centralPremise, 500) || noteLine(draft.notes ?? "", "Angle:") || draft.title,
        status: draft.status,
        subject: draft.subject ?? draft.title,
        updatedAt: draft.updatedAt.toISOString(),
        visualConcept: draft.imagePrompt?.slice(0, 300) ?? "",
      };
    });
    const revisions = await db.select({
      createdAt: contentDraftRevisions.createdAt,
      draftId: contentDraftRevisions.draftId,
      snapshot: contentDraftRevisions.snapshot,
    }).from(contentDraftRevisions).where(eq(contentDraftRevisions.ownerId, ownerId)).orderBy(desc(contentDraftRevisions.createdAt)).limit(12);
    const draftById = new Map(drafts.map((draft) => [draft.id, draft]));
    return [...current, ...revisions.flatMap((revision): AiCreativeMemory[] => {
      const snapshot = jsonRecord(revision.snapshot);
      const parent = draftById.get(revision.draftId);
      if (!snapshot || !parent) return [];
      const threadPosts = Array.isArray(snapshot.threadPosts) ? snapshot.threadPosts.filter((entry): entry is string => typeof entry === "string") : [];
      return [{
        approach: "Earlier saved revision",
        feedback: "",
        formatId: typeof snapshot.formatId === "string" ? snapshot.formatId as AiCreativeMemory["formatId"] : parent.formatId,
        hook: (threadPosts.find((post) => post.trim()) ?? text(snapshot.caption, 280)).slice(0, 280),
        mediaPath: typeof snapshot.mediaPath === "string" ? snapshot.mediaPath as AiCreativeMemory["mediaPath"] : parent.mediaPath,
        premise: text(snapshot.title, 300) || parent.title,
        status: "revision",
        subject: parent.subject ?? parent.title,
        updatedAt: revision.createdAt.toISOString(),
        visualConcept: text(snapshot.imagePrompt, 300),
      }];
    })].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, safeLimit);
  });
}

export async function listAiEvidence(options: Readonly<{ ids?: readonly string[]; limit?: number }> = {}) {
  const limit = Math.min(20, Math.max(1, options.limit ?? 20));
  if (options.ids && options.ids.length === 0) return [];
  return withDatabaseTransaction(async (db) => {
    const query = db.select({
      id: sourceItems.id,
      primaryTopic: sourceItems.primaryTopic,
      publishedAt: sourceItems.publishedAt,
      publisher: sources.name,
      publisherKind: sources.kind,
      summary: sourceItems.summary,
      title: sourceItems.title,
      url: sourceItems.originalUrl,
      verificationStatus: sourceItems.verificationStatus,
    }).from(sourceItems).innerJoin(sources, eq(sourceItems.sourceId, sources.id));
    const rows = options.ids
      ? await query.where(inArray(sourceItems.id, [...new Set(options.ids)])).orderBy(desc(sourceItems.publishedAt)).limit(limit)
      : await query.orderBy(desc(sourceItems.publishedAt), desc(sourceItems.collectedAt)).limit(limit);
    return rows.map((row) => ({ ...row, publishedAt: row.publishedAt?.toISOString() ?? null }));
  });
}

export async function listCreativeEvidence(limit = 16) {
  const safeLimit = Math.min(20, Math.max(1, limit));
  const pool = await withDatabaseTransaction(async (db) => db.select({
    id: sourceItems.id,
    primaryTopic: sourceItems.primaryTopic,
    publishedAt: sourceItems.publishedAt,
    publisher: sources.name,
    publisherKind: sources.kind,
    summary: sourceItems.summary,
    title: sourceItems.title,
    url: sourceItems.originalUrl,
    verificationStatus: sourceItems.verificationStatus,
  }).from(sourceItems).innerJoin(sources, eq(sourceItems.sourceId, sources.id))
    .orderBy(desc(sourceItems.publishedAt), desc(sourceItems.collectedAt)).limit(60));
  return selectVariedEvidence(pool.map((item) => ({ ...item, publishedAt: item.publishedAt?.toISOString() ?? null })), safeLimit);
}
