import type { AiImageProvider } from "../content-studio/image-provider.ts";
import type { ContentMediaAsset, VisualAspect } from "../content-studio/content-types.ts";
import { AiGenerationError, type AiRunStore, type AiRuntimeConfig } from "./types.ts";
import { requestFingerprint } from "./validation.ts";
import type { AiImageRuntimeConfig } from "../../server/ai/image-config.ts";

export interface AiImageAssetStore {
  findByRun(ownerId: string, runId: string): Promise<ContentMediaAsset | null>;
  save(input: Readonly<{
    altText: string; bytes: Uint8Array; draftId: string; generationPrompt: string; generationRunId: string;
    imageDescription: string; model: string; ownerId: string; provider: string; providerRequestId: string | null;
  }>): Promise<ContentMediaAsset>;
}

export async function generateEditorialImage(input: Readonly<{
  aspect: VisualAspect;
  assetStore: AiImageAssetStore;
  draftId: string;
  idempotencyKey: string;
  imageConfig: AiImageRuntimeConfig;
  ownerId: string;
  prompt: string;
  provider: AiImageProvider;
  runStore: AiRunStore;
  subject: string;
  textConfig: AiRuntimeConfig;
}>): Promise<Readonly<{ asset: ContentMediaAsset; description: string; duplicate: boolean }>> {
  if (!input.imageConfig.enabled) throw new AiGenerationError("disabled", "AI image generation is disabled.");
  const subject = input.subject.trim().slice(0, 300);
  const prompt = input.prompt.trim().slice(0, 4000);
  if (!subject || !prompt || !/^[A-Za-z0-9][A-Za-z0-9:_-]{15,127}$/.test(input.idempotencyKey)) throw new AiGenerationError("invalid_request", "The image request is invalid.");
  const reservation = await input.runStore.begin({
    evidenceIds: [], fingerprint: requestFingerprint({ aspect: input.aspect, draftId: input.draftId, prompt, subject }),
    idempotencyKey: input.idempotencyKey, kind: "image", model: input.provider.model,
    monthlyBudgetMicrousd: input.textConfig.monthlyBudgetMicrousd, ownerId: input.ownerId,
    provider: input.provider.id, requestedCount: 1, reservationMicrousd: input.imageConfig.maxEstimatedCostMicrousd,
  });
  if (reservation.duplicate) {
    const asset = await input.assetStore.findByRun(input.ownerId, reservation.runId);
    if (!asset) throw new AiGenerationError("duplicate_request", "The image request was already processed.");
    return { asset, description: asset.imageDescription, duplicate: true };
  }
  try {
    const generated = await input.provider.generate({ aspect: input.aspect, prompt, subject }, AbortSignal.timeout(input.imageConfig.requestTimeoutMs));
    const inspected = await input.provider.inspect(generated, subject, AbortSignal.timeout(input.imageConfig.requestTimeoutMs));
    const asset = await input.assetStore.save({
      altText: inspected.altText, bytes: generated.bytes, draftId: input.draftId, generationPrompt: prompt,
      generationRunId: reservation.runId, imageDescription: inspected.description, model: generated.model,
      ownerId: input.ownerId, provider: input.provider.id, providerRequestId: generated.providerRequestId,
    });
    await input.runStore.complete({
      estimatedCostMicrousd: input.imageConfig.maxEstimatedCostMicrousd,
      inputTokens: generated.inputTokens + inspected.inputTokens,
      outputTokens: generated.outputTokens + inspected.outputTokens,
      ownerId: input.ownerId, responseId: inspected.responseId, runId: reservation.runId, suggestions: [],
    });
    return { asset, description: inspected.description, duplicate: false };
  } catch (error) {
    const safe = error instanceof AiGenerationError ? error : new AiGenerationError("provider_failure", "AI image generation failed.");
    await input.runStore.fail({ errorCode: safe.code, ownerId: input.ownerId, runId: reservation.runId });
    throw safe;
  }
}
