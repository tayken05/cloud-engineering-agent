import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { ContentDraft, ContentIdea, ContentWorkspaceState, DraftSnapshot, EvidenceReference, VisualSpecification } from "../../features/content-studio/content-types.ts";
import { parseContentWorkspace, snapshotDraft } from "../../features/content-studio/content-workspace.ts";
import {
  contentDraftRevisions, contentDraftSourceItems, contentDrafts, contentIdeas,
  contentIdeaSourceItems, contentVisualSpecifications, sourceItems, sources,
} from "../db/schema.ts";
import { withDatabaseTransaction } from "../db/transaction.ts";

export class ContentConflictError extends Error {
  constructor() { super("This record changed in another session. Reload the workspace before saving again."); this.name = "ContentConflictError"; }
}

function validWorkspace(input: unknown): ContentWorkspaceState {
  const parsed = parseContentWorkspace(input);
  if (!parsed) throw new Error("Content data is invalid.");
  return parsed;
}

export function validateIdeaInput(input: unknown): ContentIdea {
  const state = validWorkspace({ version: 1, ideas: [input], drafts: [] });
  const idea = state.ideas[0];
  if (!idea || !idea.educationalObjective.trim() || !/^(idea|starter-idea)-[a-z0-9-]+$/.test(idea.id)) throw new Error("Content idea is invalid.");
  return idea;
}

export function validateDraftInput(input: unknown): ContentDraft {
  const state = validWorkspace({ version: 1, ideas: [], drafts: [input] });
  const draft = state.drafts[0];
  if (!draft || !/^(draft|starter-draft)-[a-z0-9-]+$/.test(draft.id)) throw new Error("Content draft is invalid.");
  return draft;
}

function dimensions(visual: VisualSpecification) {
  return visual.aspect === "square" ? { width: 1080, height: 1080 } : { width: 1600, height: 900 };
}

export async function loadContentWorkspace(ownerId: string): Promise<ContentWorkspaceState> {
  return withDatabaseTransaction(async (db) => {
  const ideaRows = await db.select().from(contentIdeas).where(eq(contentIdeas.ownerId, ownerId)).orderBy(desc(contentIdeas.updatedAt)).limit(100);
  const draftRows = await db.select().from(contentDrafts).where(eq(contentDrafts.ownerId, ownerId)).orderBy(desc(contentDrafts.updatedAt)).limit(100);
  const revisionRows = await db.select().from(contentDraftRevisions).where(eq(contentDraftRevisions.ownerId, ownerId)).orderBy(desc(contentDraftRevisions.createdAt)).limit(2000);
  const visualRows = await db.select().from(contentVisualSpecifications).where(eq(contentVisualSpecifications.ownerId, ownerId)).limit(100);
  const ideaEvidenceRows = await db.select({ parentId: contentIdeaSourceItems.ideaId, id: sourceItems.id, title: sourceItems.title, url: sourceItems.canonicalUrl, publishedAt: sourceItems.publishedAt, publisher: sources.name })
      .from(contentIdeaSourceItems).innerJoin(sourceItems, eq(contentIdeaSourceItems.sourceItemId, sourceItems.id)).innerJoin(sources, eq(sourceItems.sourceId, sources.id)).where(eq(contentIdeaSourceItems.ownerId, ownerId));
  const draftEvidenceRows = await db.select({ parentId: contentDraftSourceItems.draftId, id: sourceItems.id, title: sourceItems.title, url: sourceItems.canonicalUrl, publishedAt: sourceItems.publishedAt, publisher: sources.name })
      .from(contentDraftSourceItems).innerJoin(sourceItems, eq(contentDraftSourceItems.sourceItemId, sourceItems.id)).innerJoin(sources, eq(sourceItems.sourceId, sources.id)).where(eq(contentDraftSourceItems.ownerId, ownerId));
  const evidenceMap = (rows: typeof ideaEvidenceRows) => {
    const result = new Map<string, EvidenceReference[]>();
    for (const row of rows) result.set(row.parentId, [...(result.get(row.parentId) ?? []), { id: row.id, publisher: row.publisher, publishedAt: row.publishedAt?.toISOString() ?? null, title: row.title, url: row.url, verificationLabel: "publisher_record" }]);
    return result;
  };
  const ideaEvidence = evidenceMap(ideaEvidenceRows);
  const draftEvidence = evidenceMap(draftEvidenceRows);
  const visuals = new Map(visualRows.map((row) => [row.draftId, { accent: row.accent, aspect: row.aspect, caption: row.caption, footer: row.footer, leftLabel: row.leftLabel, rightLabel: row.rightLabel, subtitle: row.subtitle, templateId: row.templateId, title: row.title } satisfies VisualSpecification]));
  const revisions = new Map<string, ContentDraft["revisions"] extends readonly (infer R)[] ? R[] : never>();
  for (const row of revisionRows) {
    const snapshot = row.snapshot as unknown;
    const parsed = validateDraftInput({ id: row.draftId, recordVersion: row.draftVersion, formatId: "beginner-friendly-education", ideaId: null, status: "draft", createdAt: row.createdAt.toISOString(), updatedAt: row.createdAt.toISOString(), evidence: [], revisions: [], ...(typeof snapshot === "object" && snapshot ? snapshot : {}) });
    const list = revisions.get(row.draftId) ?? [];
    if (list.length < 20) list.push({ id: row.id, savedAt: row.createdAt.toISOString(), snapshot: snapshotDraft(parsed), version: row.draftVersion });
    revisions.set(row.draftId, list);
  }
  return {
    ideas: ideaRows.map((row) => ({ audience: row.audience, createdAt: row.createdAt.toISOString(), educationalObjective: row.educationalObjective, engagementStyle: row.engagementStyle, evidence: ideaEvidence.get(row.id) ?? [], formatId: row.formatId, id: row.id, notes: row.notes, recordVersion: row.recordVersion, status: row.status, subject: row.subject, technicalCategory: row.technicalCategory, updatedAt: row.updatedAt.toISOString() })),
    drafts: draftRows.map((row) => ({ caption: row.caption, createdAt: row.createdAt.toISOString(), evidence: draftEvidence.get(row.id) ?? [], explanation: row.explanation, formatId: row.formatId, id: row.id, ideaId: row.ideaId, moderatorNotes: row.moderatorNotes, pollOptions: row.pollOptions, recordVersion: row.recordVersion, revisions: revisions.get(row.id) ?? [], status: row.status, threadPosts: row.threadPosts, title: row.title, updatedAt: row.updatedAt.toISOString(), visual: visuals.get(row.id) ?? null })),
    version: 1,
  };
  });
}

export async function saveContentIdea(ownerId: string, input: unknown): Promise<void> {
  const idea = validateIdeaInput(input);
  await withDatabaseTransaction(async (tx) => {
    const existing = await tx.select({ version: contentIdeas.recordVersion }).from(contentIdeas).where(and(eq(contentIdeas.id, idea.id), eq(contentIdeas.ownerId, ownerId))).limit(1);
    if (existing[0]) {
      if (existing[0].version !== idea.recordVersion) throw new ContentConflictError();
      const updated = await tx.update(contentIdeas).set({ subject: idea.subject, technicalCategory: idea.technicalCategory, formatId: idea.formatId, audience: idea.audience, educationalObjective: idea.educationalObjective, engagementStyle: idea.engagementStyle, notes: idea.notes, status: idea.status, recordVersion: sql`${contentIdeas.recordVersion} + 1`, updatedAt: new Date() }).where(and(eq(contentIdeas.id, idea.id), eq(contentIdeas.ownerId, ownerId), eq(contentIdeas.recordVersion, idea.recordVersion))).returning({ id: contentIdeas.id });
      if (updated.length !== 1) throw new ContentConflictError();
    } else {
      await tx.insert(contentIdeas).values({ id: idea.id, ownerId, subject: idea.subject, technicalCategory: idea.technicalCategory, formatId: idea.formatId, audience: idea.audience, educationalObjective: idea.educationalObjective, engagementStyle: idea.engagementStyle, notes: idea.notes, status: idea.status, recordVersion: 1 });
    }
    await tx.delete(contentIdeaSourceItems).where(and(eq(contentIdeaSourceItems.ideaId, idea.id), eq(contentIdeaSourceItems.ownerId, ownerId)));
    if (idea.evidence.length) await tx.insert(contentIdeaSourceItems).values(idea.evidence.map((item) => ({ ideaId: idea.id, ownerId, sourceItemId: item.id })));
  });
}

export async function saveContentDraft(ownerId: string, input: unknown): Promise<void> {
  const draft = validateDraftInput(input);
  await withDatabaseTransaction(async (tx) => {
    const existing = await tx.select().from(contentDrafts).where(and(eq(contentDrafts.id, draft.id), eq(contentDrafts.ownerId, ownerId))).limit(1);
    if (draft.ideaId) {
      const idea = await tx.select({ id: contentIdeas.id }).from(contentIdeas).where(and(eq(contentIdeas.id, draft.ideaId), eq(contentIdeas.ownerId, ownerId))).limit(1);
      if (!idea[0]) throw new Error("The selected content idea is unavailable.");
    }
    if (existing[0]) {
      if (existing[0].recordVersion !== draft.recordVersion) throw new ContentConflictError();
      const previousVisual = await tx.select().from(contentVisualSpecifications).where(and(eq(contentVisualSpecifications.draftId, draft.id), eq(contentVisualSpecifications.ownerId, ownerId))).limit(1);
      const previousSnapshot: DraftSnapshot = { caption: existing[0].caption, explanation: existing[0].explanation, moderatorNotes: existing[0].moderatorNotes, pollOptions: existing[0].pollOptions, threadPosts: existing[0].threadPosts, title: existing[0].title, visual: previousVisual[0] ? { accent: previousVisual[0].accent, aspect: previousVisual[0].aspect, caption: previousVisual[0].caption, footer: previousVisual[0].footer, leftLabel: previousVisual[0].leftLabel, rightLabel: previousVisual[0].rightLabel, subtitle: previousVisual[0].subtitle, templateId: previousVisual[0].templateId, title: previousVisual[0].title } : null };
      if (JSON.stringify(previousSnapshot) !== JSON.stringify(snapshotDraft(draft))) await tx.insert(contentDraftRevisions).values({ draftId: draft.id, ownerId, draftVersion: existing[0].recordVersion, snapshot: previousSnapshot }).onConflictDoNothing();
      const updated = await tx.update(contentDrafts).set({ ideaId: draft.ideaId, formatId: draft.formatId, title: draft.title, caption: draft.caption, explanation: draft.explanation, moderatorNotes: draft.moderatorNotes, threadPosts: [...draft.threadPosts], pollOptions: [...draft.pollOptions], status: draft.status, recordVersion: sql`${contentDrafts.recordVersion} + 1`, updatedAt: new Date() }).where(and(eq(contentDrafts.id, draft.id), eq(contentDrafts.ownerId, ownerId), eq(contentDrafts.recordVersion, draft.recordVersion))).returning({ id: contentDrafts.id });
      if (updated.length !== 1) throw new ContentConflictError();
    } else {
      await tx.insert(contentDrafts).values({ id: draft.id, ownerId, ideaId: draft.ideaId, formatId: draft.formatId, title: draft.title, caption: draft.caption, explanation: draft.explanation, moderatorNotes: draft.moderatorNotes, threadPosts: [...draft.threadPosts], pollOptions: [...draft.pollOptions], status: draft.status, recordVersion: 1 });
    }
    await tx.delete(contentDraftSourceItems).where(and(eq(contentDraftSourceItems.draftId, draft.id), eq(contentDraftSourceItems.ownerId, ownerId)));
    if (draft.evidence.length) await tx.insert(contentDraftSourceItems).values(draft.evidence.map((item) => ({ draftId: draft.id, ownerId, sourceItemId: item.id })));
    if (draft.visual) {
      const size = dimensions(draft.visual);
      await tx.insert(contentVisualSpecifications).values({ draftId: draft.id, ownerId, ...draft.visual, ...size }).onConflictDoUpdate({ target: contentVisualSpecifications.draftId, set: { ...draft.visual, ...size, updatedAt: new Date() }, setWhere: eq(contentVisualSpecifications.ownerId, ownerId) });
    } else await tx.delete(contentVisualSpecifications).where(and(eq(contentVisualSpecifications.draftId, draft.id), eq(contentVisualSpecifications.ownerId, ownerId)));
  });
}

export async function restoreDraftRevision(ownerId: string, draftId: string, revisionId: string, expectedVersion: number): Promise<void> {
  const revision = await withDatabaseTransaction((db) => db.select().from(contentDraftRevisions).where(and(eq(contentDraftRevisions.id, revisionId), eq(contentDraftRevisions.draftId, draftId), eq(contentDraftRevisions.ownerId, ownerId))).limit(1));
  const current = await loadContentWorkspace(ownerId);
  const draft = current.drafts.find((item) => item.id === draftId);
  if (!revision[0] || !draft || draft.recordVersion !== expectedVersion) throw new ContentConflictError();
  await saveContentDraft(ownerId, { ...draft, ...(revision[0].snapshot as DraftSnapshot), recordVersion: expectedVersion });
}

export async function importContentWorkspace(ownerId: string, input: unknown): Promise<{ imported: number; skipped: number; failed: number }> {
  const workspace = validWorkspace(input);
  const ids = [...workspace.ideas.map((item) => item.id), ...workspace.drafts.map((item) => item.id)];
  const existingIdeas = workspace.ideas.length ? await withDatabaseTransaction((db) => db.select({ id: contentIdeas.id }).from(contentIdeas).where(and(eq(contentIdeas.ownerId, ownerId), inArray(contentIdeas.id, workspace.ideas.map((item) => item.id))))) : [];
  const existingDrafts = workspace.drafts.length ? await withDatabaseTransaction((db) => db.select({ id: contentDrafts.id }).from(contentDrafts).where(and(eq(contentDrafts.ownerId, ownerId), inArray(contentDrafts.id, workspace.drafts.map((item) => item.id))))) : [];
  const existing = new Set([...existingIdeas, ...existingDrafts].map((item) => item.id));
  let imported = 0; let failed = 0;
  for (const idea of workspace.ideas) { if (existing.has(idea.id)) continue; try { await saveContentIdea(ownerId, { ...idea, recordVersion: 1 }); imported += 1; } catch { failed += 1; } }
  for (const draft of workspace.drafts) { if (existing.has(draft.id)) continue; try { await saveContentDraft(ownerId, { ...draft, recordVersion: 1 }); imported += 1; } catch { failed += 1; } }
  return { imported, skipped: ids.length - imported - failed, failed };
}
