"use server";

import { revalidatePath } from "next/cache";

import { generateEditorialImage } from "@/features/ai-content/image-service";
import { generateDraft } from "@/features/ai-content/service";
import { AiGenerationError } from "@/features/ai-content/types";
import type { ContentMediaAsset, ContentWorkspaceState, VisualAspect } from "@/features/content-studio/content-types";
import { getRequiredOwnerId } from "@/server/auth/owner";
import { loadContentWorkspace, saveContentDraft } from "@/server/content/workspace-repository";
import { findContentMediaAssetByRun, saveGeneratedMediaAsset } from "@/server/content/media-repository";
import { readAiRuntimeConfig, readOpenAiApiKey } from "./config";
import { readAiImageRuntimeConfig } from "./image-config";
import { createOpenAiImageProvider } from "./openai-image-provider";
import { createOpenAiProvider } from "./openai-provider";
import { listAiEvidence, listExistingContentSubjects, PostgresAiRunStore } from "./repository";

type ImageActionResult = Readonly<{
  asset?: ContentMediaAsset;
  error?: string;
  groundedDraftSaved?: boolean;
  ok: boolean;
  state?: ContentWorkspaceState;
  warning?: string;
}>;

function safe(error: unknown): string {
  if (error instanceof AiGenerationError) {
    if (error.code === "budget_exhausted") return "The shared monthly AI allowance cannot cover this image request.";
    if (error.code === "already_running") return "Another AI request is still running. Try again when it finishes.";
    if (error.code === "invalid_request") return error.message;
    if (error.code === "disabled") return "AI image generation is disabled by server configuration.";
  }
  return "The image package was not completed. No unverified success was recorded.";
}

export async function generateAiImageAction(value: unknown): Promise<ImageActionResult> {
  const ownerId = await getRequiredOwnerId();
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new AiGenerationError("invalid_request", "The image request is invalid.");
    const input = value as Record<string, unknown>;
    const draftId = typeof input.draftId === "string" ? input.draftId : "";
    const idempotencyKey = typeof input.idempotencyKey === "string" ? input.idempotencyKey : "";
    const aspect: VisualAspect = input.aspect === "landscape" ? "landscape" : "square";
    const expectedVersion = typeof input.expectedVersion === "number" ? Math.floor(input.expectedVersion) : 0;
    if (!/^(draft|starter-draft)-[a-z0-9-]+$/.test(draftId) || expectedVersion < 1) throw new AiGenerationError("invalid_request", "The image request is invalid.");
    const state = await loadContentWorkspace(ownerId);
    const draft = state.drafts.find((item) => item.id === draftId);
    if (!draft || draft.recordVersion !== expectedVersion) return { error: "This draft changed in another session. Save and reload before generating an image.", ok: false };
    if (draft.mediaPath === "text_only") return { error: "Choose Text first or Image first before generating an image.", ok: false };
    if (!draft.imagePrompt.trim() || !draft.title.trim()) return { error: "Add a specific subject and reviewed image brief before generation.", ok: false };
    const textConfig = readAiRuntimeConfig();
    const imageConfig = readAiImageRuntimeConfig();
    const apiKey = readOpenAiApiKey();
    const runStore = new PostgresAiRunStore();
    const generated = await generateEditorialImage({
      aspect, draftId, idempotencyKey, imageConfig, ownerId, prompt: draft.imagePrompt,
      provider: createOpenAiImageProvider(imageConfig, textConfig, apiKey), runStore, subject: draft.title, textConfig,
      assetStore: {
        findByRun: findContentMediaAssetByRun,
        save: saveGeneratedMediaAsset,
      },
    });
    let nextState = state;
    if (draft.mediaPath === "image_first") {
      try {
        const evidence = await listAiEvidence({ ids: draft.evidence.map((item) => item.id), limit: 12 });
        const existingContent = await listExistingContentSubjects(ownerId);
        const output = await generateDraft({
          angle: "Write the post from the inspected image. Refer only to visible details in the supplied inspection. For Ask Grok, ask one diagnosis or comparison question about the actual image and keep the correct answer private.",
          config: textConfig, draft, evidence, existingContent, idempotencyKey: `${idempotencyKey}:caption`, idea: draft.ideaId ? state.ideas.find((item) => item.id === draft.ideaId) ?? null : null,
          imageDescription: generated.description, intent: "develop_current", ownerId, provider: createOpenAiProvider(textConfig, apiKey), store: runStore, subject: draft.title,
        });
        if (!output.output) throw new AiGenerationError("duplicate_request", "The grounded caption request was already processed.");
        await saveContentDraft(ownerId, { ...draft, caption: output.output.caption, explanation: `${output.output.explanation}\n\nInspected image: ${generated.description}`, imageAltText: generated.asset.altText, moderatorNotes: [output.output.moderatorNotes, `AI verification: ${output.output.verificationStatus}.`, ...output.output.reviewFlags].filter(Boolean).join("\n"), pollOptions: output.output.pollOptions, status: output.output.verificationStatus === "needs_review" || output.output.reviewFlags.length > 0 ? "needs_review" : "ready_for_review", threadPosts: output.output.threadPosts, title: output.output.title, visual: output.output.visual });
        nextState = await loadContentWorkspace(ownerId);
      } catch {
        revalidatePath("/studio");
        return {
          asset: generated.asset,
          groundedDraftSaved: false,
          ok: true,
          state: await loadContentWorkspace(ownerId),
          warning: "The image was generated, inspected, and stored, but grounded copy was not saved. Reload the draft and try the text step again without generating another image.",
        };
      }
    }
    revalidatePath("/studio");
    if (draft.mediaPath === "text_first") {
      const status = draft.moderatorNotes.includes("AI verification: evidence_backed.") ? "ready_for_review" : "needs_review";
      await saveContentDraft(ownerId, { ...draft, status });
      nextState = await loadContentWorkspace(ownerId);
    }
    return { asset: generated.asset, groundedDraftSaved: draft.mediaPath === "image_first", ok: true, state: nextState };
  } catch (error) {
    return { error: safe(error), ok: false };
  }
}
