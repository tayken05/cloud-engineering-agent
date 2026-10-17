"use server";

import { revalidatePath } from "next/cache";

import { generateDraft, generateIdeaBatch, preparePost } from "@/features/ai-content/service";
import { prepareDraftGenerationContext } from "@/features/ai-content/draft-context";
import { AiGenerationError, type AiIdeaRequest, type AiPublicStatus, type AiResearchEvidence } from "@/features/ai-content/types";
import { validateDraftRequest, validateIdeaSuggestions } from "@/features/ai-content/validation";
import type { ContentWorkspaceState, EvidenceReference } from "@/features/content-studio/content-types";
import { getRequiredOwnerId } from "@/server/auth/owner";
import { loadContentWorkspace, saveContentDraft, saveContentIdea, savePreparedContentPackage } from "@/server/content/workspace-repository";
import { readAiRuntimeConfig, readOpenAiApiKey } from "./config";
import { createOpenAiProvider } from "./openai-provider";
import {
  getAiRunSuggestion,
  getAiSuggestion,
  listCreativeEvidence,
  listCreativeMemory,
  listAiEvidence,
  listAiIdeaSuggestions,
  listExistingContentSubjects,
  PostgresAiRunStore,
  setAiSuggestionDecision,
  type AiSuggestionView,
} from "./repository";
import { getOwnerAiStatus } from "./status";

export type AiIdeaActionResult = Readonly<{
  error?: string;
  ok: boolean;
  suggestions?: readonly AiSuggestionView[];
}>;

export type AiDraftActionResult = Readonly<{
  error?: string;
  ok: boolean;
  state?: ContentWorkspaceState;
}>;

export type PreparePostActionResult = Readonly<{
  draftId?: string;
  error?: string;
  mediaPath?: "text_only" | "text_first" | "image_first";
  message?: string;
  noOpportunity?: boolean;
  ok: boolean;
  state?: ContentWorkspaceState;
}>;

function safeError(error: unknown): string {
  if (!(error instanceof AiGenerationError)) return "AI generation could not be completed. No successful generation was recorded.";
  if (error.code === "disabled") return "AI generation is disabled by server configuration.";
  if (error.code === "budget_exhausted") return "The configured AI spending allowance is zero or exhausted.";
  if (error.code === "already_running") return "Another generation request is still running. Try again after it finishes.";
  if (error.code === "duplicate_request") return "This generation request was already processed.";
  if (error.code === "invalid_request") return error.message;
  if (error.code === "invalid_output") return "The provider response failed editorial validation and was not saved as content.";
  if (error.code === "provider_timeout") return "The AI provider timed out before returning a validated result.";
  return "The AI provider request failed. No successful generation was recorded.";
}

function runtime() {
  const config = readAiRuntimeConfig();
  if (!config.enabled || config.monthlyBudgetMicrousd <= 0) throw new AiGenerationError(config.enabled ? "budget_exhausted" : "disabled", "AI generation is unavailable.");
  return { config, provider: createOpenAiProvider(config, readOpenAiApiKey()), store: new PostgresAiRunStore() };
}

function evidenceReference(item: AiResearchEvidence): EvidenceReference {
  return { id: item.id, publishedAt: item.publishedAt, publisher: item.publisher, title: item.title, url: item.url, verificationLabel: "publisher_record" };
}

export async function getAiWorkspaceStatus(): Promise<AiPublicStatus> {
  const ownerId = await getRequiredOwnerId();
  return getOwnerAiStatus(ownerId);
}

export async function generateAiIdeasAction(request: AiIdeaRequest): Promise<AiIdeaActionResult> {
  const ownerId = await getRequiredOwnerId();
  try {
    const { config, provider, store } = runtime();
    const evidence = await listAiEvidence({ limit: request.researchPath === "news" ? 20 : 8 });
    const existingSubjects = await listExistingContentSubjects(ownerId);
    await generateIdeaBatch({ config, evidence, existingSubjects, ownerId, provider, request, store });
    revalidatePath("/ideas");
    return { ok: true, suggestions: await listAiIdeaSuggestions(ownerId) };
  } catch (error) { return { error: safeError(error), ok: false }; }
}

export async function prepareAiPostAction(value: unknown): Promise<PreparePostActionResult> {
  const ownerId = await getRequiredOwnerId();
  try {
    const { config, provider, store } = runtime();
    const [evidence, creativeMemory] = await Promise.all([
      listCreativeEvidence(16),
      listCreativeMemory(ownerId, 30),
    ]);
    const generated = await preparePost({ config, creativeMemory, evidence, ownerId, provider, request: value, store });
    if (generated.duplicate || !generated.output) {
      return { error: "This Prepare a Post request was already processed. Reload the workspace to see its result.", ok: false };
    }
    if (!generated.output.worthPublishing || !generated.output.idea || !generated.output.draft || generated.output.selectedCandidateIndex === null) {
      const suggestion = await getAiRunSuggestion(ownerId, generated.runId);
      if (suggestion) await setAiSuggestionDecision({ feedback: generated.output.selectionRationale, ownerId, status: "rejected", suggestionId: suggestion.id });
      return { message: generated.output.selectionRationale, noOpportunity: true, ok: true, state: await loadContentWorkspace(ownerId) };
    }
    const { draft: output, idea, selectionRationale } = generated.output;
    const selectedCandidate = generated.output.candidates[generated.output.selectedCandidateIndex];
    if (!selectedCandidate) return { error: "The selected creative opportunity was unavailable after validation.", ok: false };
    const now = new Date().toISOString();
    const ideaId = `idea-${generated.runId}`;
    const draftId = `draft-${crypto.randomUUID()}`;
    const ideaEvidence = evidence.filter((item) => idea.evidenceSourceItemIds.includes(item.id)).map(evidenceReference);
    const draftEvidence = evidence.filter((item) => output.evidenceSourceItemIds.includes(item.id)).map(evidenceReference);
    const needsReview = output.verificationStatus === "needs_review" || output.reviewFlags.length > 0 || output.mediaRecommendation.path !== "text_only";
    await savePreparedContentPackage(ownerId, {
      audience: idea.audience,
      createdAt: now,
      educationalObjective: idea.editorialPurpose,
      engagementStyle: idea.engagementStyle,
      evidence: ideaEvidence,
      formatId: idea.formatId,
      id: ideaId,
      notes: [
        `Prepared by the newsroom. ${idea.whyInteresting}`,
        `Central premise: ${selectedCandidate.centralPremise}`,
        `Selected premise: ${selectionRationale}`,
        `Angle: ${idea.contentAngle}`,
        `Creative approach: ${selectedCandidate.creativeApproach}`,
        `Reader experience: ${selectedCandidate.readerExperience}`,
        `Evidence basis: ${selectedCandidate.evidenceBasis}.`,
        `Verification: ${idea.verificationStatus}.`,
        ...selectedCandidate.editorialRisks.map((risk) => `Editorial risk: ${risk}`),
        ...idea.reviewFlags,
      ].filter(Boolean).join("\n"),
      recordVersion: 1,
      status: "drafted",
      subject: idea.title,
      technicalCategory: idea.technicalCategory,
      updatedAt: now,
    }, {
      caption: output.caption,
      createdAt: now,
      evidence: draftEvidence,
      explanation: output.explanation,
      formatId: idea.formatId,
      id: draftId,
      ideaId,
      imageAltText: output.mediaRecommendation.altText,
      imagePrompt: output.mediaRecommendation.imagePrompt,
      mediaPath: output.mediaRecommendation.path,
      moderatorNotes: [
        output.moderatorNotes,
        `AI verification: ${output.verificationStatus}.`,
        `Media decision: ${output.mediaRecommendation.rationale}`,
        ...output.reviewFlags,
      ].filter(Boolean).join("\n"),
      pollOptions: output.pollOptions,
      recordVersion: 1,
      revisions: [],
      status: needsReview ? "needs_review" : "ready_for_review",
      threadPosts: output.threadPosts,
      title: output.title,
      updatedAt: now,
      visual: output.visual,
    });
    const suggestion = await getAiRunSuggestion(ownerId, generated.runId);
    if (suggestion) await setAiSuggestionDecision({ acceptedDraftId: draftId, ownerId, status: "accepted", suggestionId: suggestion.id });
    revalidatePath("/ideas"); revalidatePath("/studio");
    return { draftId, mediaPath: output.mediaRecommendation.path, ok: true, state: await loadContentWorkspace(ownerId) };
  } catch (error) {
    return { error: safeError(error), ok: false };
  }
}

export async function reviewAiIdeaAction(suggestionId: string, decision: "accept" | "reject", feedback = ""): Promise<AiIdeaActionResult> {
  const ownerId = await getRequiredOwnerId();
  if (!/^[0-9a-f-]{36}$/i.test(suggestionId) || !["accept", "reject"].includes(decision) || feedback.length > 2000) return { error: "The editorial decision is invalid.", ok: false };
  try {
    const row = await getAiSuggestion(ownerId, suggestionId);
    if (!row || row.kind !== "idea_batch" || row.editorialStatus !== "proposed") throw new Error("Suggestion unavailable");
    if (decision === "reject") {
      await setAiSuggestionDecision({ feedback, ownerId, status: "rejected", suggestionId });
    } else {
      const raw = row.payload as { evidenceSourceItemIds?: unknown };
      const ids = Array.isArray(raw.evidenceSourceItemIds) ? raw.evidenceSourceItemIds.filter((id): id is string => typeof id === "string") : [];
      const evidence = await listAiEvidence({ ids, limit: 12 });
      const suggestion = validateIdeaSuggestions({ ideas: [row.payload] }, new Set(evidence.map((item) => item.id)), 1)[0];
      if (!suggestion) throw new Error("Suggestion unavailable");
      const now = new Date().toISOString();
      const ideaId = `idea-${suggestionId}`;
      const series = suggestion.seriesKey ? `Series: ${suggestion.seriesKey}${suggestion.seriesPosition ? ` · episode ${suggestion.seriesPosition}` : ""}.` : "";
      await saveContentIdea(ownerId, {
        audience: suggestion.audience,
        createdAt: now,
        educationalObjective: suggestion.educationalObjective,
        engagementStyle: suggestion.engagementStyle,
        evidence: evidence.map(evidenceReference),
        formatId: suggestion.formatId,
        id: ideaId,
        notes: [`AI-assisted proposal. ${suggestion.whyUseful}`, `Angle: ${suggestion.contentAngle}`, `Verification: ${suggestion.verificationStatus}.`, series, ...suggestion.reviewFlags].filter(Boolean).join("\n"),
        recordVersion: 1,
        status: "approved",
        subject: suggestion.title,
        technicalCategory: suggestion.technicalCategory,
        updatedAt: now,
      });
      await setAiSuggestionDecision({ acceptedIdeaId: ideaId, feedback, ownerId, status: "accepted", suggestionId });
    }
    revalidatePath("/ideas"); revalidatePath("/studio");
    return { ok: true, suggestions: await listAiIdeaSuggestions(ownerId) };
  } catch { return { error: "The suggestion could not be reviewed safely.", ok: false }; }
}

export async function generateAiDraftAction(value: unknown): Promise<AiDraftActionResult> {
  const ownerId = await getRequiredOwnerId();
  try {
    const request = validateDraftRequest(value);
    const { config, provider, store } = runtime();
    const state = await loadContentWorkspace(ownerId);
    const draft = state.drafts.find((item) => item.id === request.draftId);
    if (!draft || draft.recordVersion !== request.expectedVersion) return { error: "This draft changed in another session. Reload before generating.", ok: false };
    const attachedIdea = draft.ideaId ? state.ideas.find((item) => item.id === draft.ideaId) ?? null : null;
    const context = prepareDraftGenerationContext({ draft, idea: attachedIdea, intent: request.intent, requestedSubject: request.subject });
    const { idea, subject } = context;
    const evidenceIds = [...new Set([...draft.evidence, ...(idea?.evidence ?? [])].map((item) => item.id))];
    const evidence = await listAiEvidence({ ids: evidenceIds, limit: 12 });
    const existingContent = await listExistingContentSubjects(ownerId);
    const generationDraft = context.draft;
    const generated = await generateDraft({
      angle: request.angle, config, draft: generationDraft, evidence, existingContent,
      idempotencyKey: request.idempotencyKey, idea, intent: request.intent, ownerId, provider, store, subject,
    });
    if (generated.duplicate || !generated.output) return { error: "This draft-generation request was already processed. Reload the workspace to see its result.", ok: false };
    const output = generated.output;
    await saveContentDraft(ownerId, {
      ...draft,
      caption: output.caption,
      evidence: evidence.filter((item) => output.evidenceSourceItemIds.includes(item.id)).map(evidenceReference),
      explanation: output.explanation,
      ideaId: request.intent === "new_subject" ? null : draft.ideaId,
      imageAltText: output.mediaRecommendation.altText,
      imagePrompt: output.mediaRecommendation.imagePrompt,
      mediaPath: output.mediaRecommendation.path,
      moderatorNotes: [output.moderatorNotes, `AI verification: ${output.verificationStatus}.`, ...output.reviewFlags].filter(Boolean).join("\n"),
      pollOptions: output.pollOptions,
      status: output.verificationStatus === "needs_review" || output.reviewFlags.length > 0 ? "needs_review" : "ready_for_review",
      threadPosts: output.threadPosts,
      title: output.title,
      updatedAt: new Date().toISOString(),
      visual: output.visual,
    });
    const suggestion = await getAiRunSuggestion(ownerId, generated.runId);
    if (suggestion) await setAiSuggestionDecision({ acceptedDraftId: draft.id, ownerId, status: "accepted", suggestionId: suggestion.id });
    revalidatePath("/ideas"); revalidatePath("/studio");
    return { ok: true, state: await loadContentWorkspace(ownerId) };
  } catch (error) { return { error: safeError(error), ok: false }; }
}
