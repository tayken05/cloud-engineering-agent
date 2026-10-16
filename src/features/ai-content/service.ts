import type { ContentDraft, ContentIdea } from "../content-studio/content-types.ts";
import { draftInput, draftInstructions, ideaInput, ideaInstructions } from "./prompts.ts";
import {
  draftOutputSchema,
  ideaOutputSchema,
  isNearDuplicate,
  requestFingerprint,
  validateDraftOutput,
  validateIdeaRequest,
  validateIdeaSuggestions,
} from "./validation.ts";
import {
  AiGenerationError,
  type AiDraftOutput,
  type AiIdeaSuggestion,
  type AiResearchEvidence,
  type AiRunStore,
  type AiRuntimeConfig,
  type AiTextProvider,
} from "./types.ts";

const IDEA_MAX_OUTPUT_TOKENS = 3_200;
const DRAFT_MAX_OUTPUT_TOKENS = 4_800;

function ensureEnabled(config: AiRuntimeConfig) {
  if (!config.enabled) throw new AiGenerationError("disabled", "AI generation is disabled by configuration.");
  if (config.monthlyBudgetMicrousd <= 0) throw new AiGenerationError("budget_exhausted", "The AI monthly allowance is zero.");
}

function estimatedInputTokens(value: string): number {
  // UTF-8 byte length is a conservative upper bound for tokenizer pieces.
  return new TextEncoder().encode(value).byteLength;
}

export function estimateCostMicrousd(config: AiRuntimeConfig, inputTokens: number, outputTokens: number): number {
  return Math.ceil(inputTokens * config.inputCostPerMillionUsd + outputTokens * config.outputCostPerMillionUsd);
}

function payload(value: object): Readonly<Record<string, unknown>> {
  return JSON.parse(JSON.stringify(value)) as Readonly<Record<string, unknown>>;
}

export async function generateIdeaBatch(input: Readonly<{
  config: AiRuntimeConfig;
  evidence: readonly AiResearchEvidence[];
  existingSubjects: readonly string[];
  ownerId: string;
  provider: AiTextProvider;
  request: unknown;
  store: AiRunStore;
}>): Promise<Readonly<{ duplicate: boolean; runId: string; suggestions: readonly AiIdeaSuggestion[] }>> {
  ensureEnabled(input.config);
  const request = validateIdeaRequest(input.request);
  const evidence = request.researchPath === "news" ? input.evidence.slice(0, 20) : input.evidence.slice(0, 8);
  const allowedEvidence = new Set(evidence.map((item) => item.id));
  const instructions = ideaInstructions();
  const providerInput = ideaInput(request, evidence, input.existingSubjects);
  const reservationMicrousd = estimateCostMicrousd(input.config, estimatedInputTokens(`${instructions}\n${providerInput}`), IDEA_MAX_OUTPUT_TOKENS);
  const fingerprint = requestFingerprint({ request, evidenceIds: [...allowedEvidence].sort() });
  const reservation = await input.store.begin({
    evidenceIds: [...allowedEvidence], fingerprint, idempotencyKey: request.idempotencyKey,
    kind: "idea_batch", model: input.provider.model, monthlyBudgetMicrousd: input.config.monthlyBudgetMicrousd,
    ownerId: input.ownerId, provider: input.provider.id, requestedCount: request.batchSize, reservationMicrousd,
  });
  if (reservation.duplicate) return { duplicate: true, runId: reservation.runId, suggestions: [] };
  try {
    const signal = AbortSignal.timeout(input.config.requestTimeoutMs);
    const result = await input.provider.generateStructured({ input: providerInput, instructions, maxOutputTokens: IDEA_MAX_OUTPUT_TOKENS, schema: ideaOutputSchema(), schemaName: "cloud_content_idea_batch", signal });
    const suggestions = validateIdeaSuggestions(result.data, allowedEvidence, request.batchSize);
    const prior = [...input.existingSubjects];
    for (const suggestion of suggestions) {
      if (isNearDuplicate(`${suggestion.title} ${suggestion.technicalSubject}`, prior)) throw new AiGenerationError("invalid_output", "The generated batch repeated existing or proposed content.");
      prior.push(`${suggestion.title} ${suggestion.technicalSubject}`);
    }
    await input.store.complete({
      estimatedCostMicrousd: estimateCostMicrousd(input.config, result.inputTokens, result.outputTokens),
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      ownerId: input.ownerId,
      responseId: result.responseId,
      runId: reservation.runId,
      suggestions: suggestions.map((suggestion) => ({ kind: "idea_batch" as const, payload: payload(suggestion), verificationStatus: suggestion.verificationStatus })),
    });
    return { duplicate: false, runId: reservation.runId, suggestions };
  } catch (error) {
    const safe = error instanceof AiGenerationError ? error : new AiGenerationError("provider_failure", "AI idea generation failed.");
    await input.store.fail({ errorCode: safe.code, ownerId: input.ownerId, runId: reservation.runId });
    throw safe;
  }
}

export async function generateDraft(input: Readonly<{
  angle: string;
  config: AiRuntimeConfig;
  draft: ContentDraft;
  evidence: readonly AiResearchEvidence[];
  idempotencyKey: string;
  idea: ContentIdea | null;
  ownerId: string;
  provider: AiTextProvider;
  store: AiRunStore;
}>): Promise<Readonly<{ duplicate: boolean; output: AiDraftOutput | null; runId: string }>> {
  ensureEnabled(input.config);
  const evidence = input.evidence.slice(0, 12);
  const allowedEvidence = new Set(evidence.map((item) => item.id));
  const instructions = draftInstructions(input.draft.formatId);
  const providerInput = draftInput(input.draft, input.idea, input.angle, evidence);
  const fingerprint = requestFingerprint({ angle: input.angle, draftId: input.draft.id, evidenceIds: [...allowedEvidence].sort(), version: input.draft.recordVersion });
  const reservationMicrousd = estimateCostMicrousd(input.config, estimatedInputTokens(`${instructions}\n${providerInput}`), DRAFT_MAX_OUTPUT_TOKENS);
  const reservation = await input.store.begin({ evidenceIds: [...allowedEvidence], fingerprint, idempotencyKey: input.idempotencyKey, kind: "draft", model: input.provider.model, monthlyBudgetMicrousd: input.config.monthlyBudgetMicrousd, ownerId: input.ownerId, provider: input.provider.id, requestedCount: 1, reservationMicrousd });
  if (reservation.duplicate) return { duplicate: true, output: null, runId: reservation.runId };
  try {
    const signal = AbortSignal.timeout(input.config.requestTimeoutMs);
    const result = await input.provider.generateStructured({ input: providerInput, instructions, maxOutputTokens: DRAFT_MAX_OUTPUT_TOKENS, schema: draftOutputSchema(), schemaName: "cloud_content_draft", signal });
    const output = validateDraftOutput(result.data, input.draft.formatId, allowedEvidence);
    await input.store.complete({
      estimatedCostMicrousd: estimateCostMicrousd(input.config, result.inputTokens, result.outputTokens),
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      ownerId: input.ownerId,
      responseId: result.responseId,
      runId: reservation.runId,
      suggestions: [{ kind: "draft", payload: payload(output), verificationStatus: output.verificationStatus }],
    });
    return { duplicate: false, output, runId: reservation.runId };
  } catch (error) {
    const safe = error instanceof AiGenerationError ? error : new AiGenerationError("provider_failure", "AI draft generation failed.");
    await input.store.fail({ errorCode: safe.code, ownerId: input.ownerId, runId: reservation.runId });
    throw safe;
  }
}
