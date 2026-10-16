"use server";

import { revalidatePath } from "next/cache";

import type { ContentDraft, ContentIdea, ContentWorkspaceState, IdeaStatus } from "@/features/content-studio/content-types";
import { blankDraft, validateDraft } from "@/features/content-studio/content-workspace";
import type { ContentFormatId } from "@/features/content-studio/content-formats";
import { getRequiredOwnerId } from "@/server/auth/owner";
import { hasContentMediaAsset } from "./media-repository";
import { ContentConflictError, importContentWorkspace, loadContentWorkspace, restoreDraftRevision, saveContentDraft, saveContentIdea } from "./workspace-repository";

export type WorkspaceActionResult = Readonly<{ ok: boolean; state?: ContentWorkspaceState; error?: string; conflict?: boolean; importResult?: Readonly<{ imported: number; skipped: number; failed: number }> }>;

function safeError(error: unknown): Pick<WorkspaceActionResult, "error" | "conflict"> {
  if (error instanceof ContentConflictError) return { error: error.message, conflict: true };
  return { error: "The workspace could not be saved. No success was recorded." };
}

async function refreshed(ownerId: string, extra: Partial<WorkspaceActionResult> = {}): Promise<WorkspaceActionResult> {
  revalidatePath("/ideas"); revalidatePath("/studio");
  return { ok: true, state: await loadContentWorkspace(ownerId), ...extra };
}

export async function saveIdeaAction(input: ContentIdea): Promise<WorkspaceActionResult> {
  const ownerId = await getRequiredOwnerId();
  try { await saveContentIdea(ownerId, input); return await refreshed(ownerId); } catch (error) { return { ok: false, ...safeError(error) }; }
}

export async function updateIdeaStatusAction(input: ContentIdea, status: IdeaStatus): Promise<WorkspaceActionResult> {
  return saveIdeaAction({ ...input, status });
}

export async function createDraftAction(formatId: ContentFormatId): Promise<WorkspaceActionResult & { draftId?: string }> {
  const ownerId = await getRequiredOwnerId();
  const id = `draft-${crypto.randomUUID()}`; const now = new Date().toISOString();
  try { await saveContentDraft(ownerId, blankDraft(formatId, now, id)); return { ...(await refreshed(ownerId)), draftId: id }; } catch (error) { return { ok: false, ...safeError(error) }; }
}

export async function createDraftFromIdeaAction(input: ContentIdea): Promise<WorkspaceActionResult & { draftId?: string }> {
  const ownerId = await getRequiredOwnerId();
  try {
    const state = await loadContentWorkspace(ownerId);
    const idea = state.ideas.find((item) => item.id === input.id);
    if (!idea) throw new Error("Idea unavailable");
    const existing = state.drafts.find((item) => item.ideaId === idea.id);
    if (existing) return { ok: true, state, draftId: existing.id };
    const id = `draft-${crypto.randomUUID()}`; const now = new Date().toISOString();
    await saveContentDraft(ownerId, { ...blankDraft(idea.formatId, now, id), evidence: idea.evidence, explanation: idea.educationalObjective, ideaId: idea.id, title: idea.subject });
    await saveContentIdea(ownerId, { ...idea, status: "drafted" });
    return { ...(await refreshed(ownerId)), draftId: id };
  } catch (error) { return { ok: false, ...safeError(error) }; }
}

export async function saveDraftAction(input: ContentDraft): Promise<WorkspaceActionResult> {
  const ownerId = await getRequiredOwnerId();
  try { await saveContentDraft(ownerId, input); return await refreshed(ownerId); } catch (error) { return { ok: false, ...safeError(error) }; }
}

export async function reviewDraftAction(
  draftId: string,
  expectedVersion: number,
  decision: "approve" | "reject",
  feedback = "",
): Promise<WorkspaceActionResult> {
  const ownerId = await getRequiredOwnerId();
  if (!/^(draft|starter-draft)-[a-z0-9-]+$/.test(draftId) || !Number.isInteger(expectedVersion)
    || expectedVersion < 1 || !["approve", "reject"].includes(decision) || feedback.length > 1000) {
    return { ok: false, error: "The editorial decision is invalid." };
  }
  try {
    const state = await loadContentWorkspace(ownerId);
    const draft = state.drafts.find((item) => item.id === draftId);
    if (!draft || draft.recordVersion !== expectedVersion) throw new ContentConflictError();
    if (decision === "approve") {
      const problems = validateDraft(draft);
      if (problems.length > 0) return { ok: false, error: `Resolve the X preflight checks before approval: ${problems[0]}` };
      if (draft.mediaPath !== "text_only" && !(await hasContentMediaAsset(ownerId, draft.id))) {
        return { ok: false, error: "Generate or attach the reviewed image before approving this media-based post, or change it to Text only." };
      }
    }
    const rejectionNote = decision === "reject" && feedback.trim()
      ? `${draft.moderatorNotes}${draft.moderatorNotes ? "\n\n" : ""}Editorial rejection: ${feedback.trim()}`
      : draft.moderatorNotes;
    await saveContentDraft(ownerId, {
      ...draft,
      moderatorNotes: rejectionNote.slice(0, 6000),
      status: decision === "approve" ? "approved" : "rejected",
    });
    return await refreshed(ownerId);
  } catch (error) {
    return { ok: false, ...safeError(error) };
  }
}

export async function restoreDraftRevisionAction(draftId: string, revisionId: string, expectedVersion: number): Promise<WorkspaceActionResult> {
  const ownerId = await getRequiredOwnerId();
  if (!/^(draft|starter-draft)-[a-z0-9-]+$/.test(draftId) || !/^[0-9a-f-]{36}$/.test(revisionId) || !Number.isInteger(expectedVersion)) return { ok: false, error: "The revision request is invalid." };
  try { await restoreDraftRevision(ownerId, draftId, revisionId, expectedVersion); return await refreshed(ownerId); } catch (error) { return { ok: false, ...safeError(error) }; }
}

export async function importBrowserWorkspaceAction(input: unknown): Promise<WorkspaceActionResult> {
  const ownerId = await getRequiredOwnerId();
  try { const importResult = await importContentWorkspace(ownerId, input); return await refreshed(ownerId, { importResult }); } catch { return { ok: false, error: "The browser backup was invalid or could not be imported." }; }
}
