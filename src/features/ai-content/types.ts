import type { ContentFormatId } from "../content-studio/content-formats.ts";
import type {
  AudienceLevel,
  EngagementStyle,
  TechnicalCategory,
  VisualSpecification,
  ContentMediaPath,
} from "../content-studio/content-types.ts";

export const AI_RESEARCH_PATHS = ["news", "evergreen"] as const;
export const AI_PRESENTATIONS = ["standalone", "thread", "poll", "visual"] as const;
export const AI_VERIFICATION_STATUSES = ["evidence_backed", "needs_review"] as const;
export const AI_DRAFT_INTENTS = ["develop_current", "new_subject"] as const;
export const AI_EVIDENCE_BASES = [
  "official_publisher_announcement",
  "independently_supported_fact",
  "unverified_claim",
  "interpretation",
  "fictional_premise",
  "evergreen_knowledge",
] as const;

export type AiResearchPath = (typeof AI_RESEARCH_PATHS)[number];
export type AiPresentation = (typeof AI_PRESENTATIONS)[number];
export type AiVerificationStatus = (typeof AI_VERIFICATION_STATUSES)[number];
export type AiDraftIntent = (typeof AI_DRAFT_INTENTS)[number];
export type AiEvidenceBasis = (typeof AI_EVIDENCE_BASES)[number];

export type AiResearchEvidence = Readonly<{
  id: string;
  primaryTopic: TechnicalCategory | null;
  publishedAt: string | null;
  publisher: string;
  publisherKind: "official_feed" | "publisher" | "engineering_organization" | "community";
  summary: string | null;
  title: string;
  url: string;
  verificationStatus: string;
}>;

export type AiCreativeMemory = Readonly<{
  approach: string;
  feedback: string;
  formatId: ContentFormatId;
  hook: string;
  mediaPath: ContentMediaPath;
  premise: string;
  status: string;
  subject: string;
  updatedAt: string;
  visualConcept: string;
}>;

export type AiCreativeCandidate = Readonly<{
  centralPremise: string;
  creativeApproach: string;
  editorialRisks: readonly string[];
  evidenceBasis: AiEvidenceBasis;
  evidenceSourceItemIds: readonly string[];
  formatId: ContentFormatId;
  interestingReason: string;
  mediaPath: ContentMediaPath;
  proposedPresentation: AiPresentation;
  readerExperience: string;
}>;

export type AiPreparedIdea = Readonly<{
  audience: AudienceLevel;
  contentAngle: string;
  editorialPurpose: string;
  engagementStyle: EngagementStyle;
  evidenceSourceItemIds: readonly string[];
  formatId: ContentFormatId;
  recommendedPresentation: AiPresentation;
  reviewFlags: readonly string[];
  seriesKey: string | null;
  seriesPosition: number | null;
  suggestedVisual: VisualSpecification | null;
  technicalCategory: TechnicalCategory;
  technicalSubject: string;
  title: string;
  verificationStatus: AiVerificationStatus;
  whyInteresting: string;
}>;

export type AiIdeaRequest = Readonly<{
  audience: AudienceLevel | null;
  batchSize: number;
  contentObjective: string;
  formatId: ContentFormatId | null;
  idempotencyKey: string;
  researchPath: AiResearchPath;
  topic: string;
}>;

export type AiPreparePostRequest = Readonly<{
  direction: string;
  idempotencyKey: string;
}>;

export type AiIdeaSuggestion = Readonly<{
  audience: AudienceLevel;
  contentAngle: string;
  educationalObjective: string;
  engagementStyle: EngagementStyle;
  evidenceSourceItemIds: readonly string[];
  formatId: ContentFormatId;
  recommendedPresentation: AiPresentation;
  reviewFlags: readonly string[];
  seriesKey: string | null;
  seriesPosition: number | null;
  suggestedVisual: VisualSpecification | null;
  technicalCategory: TechnicalCategory;
  technicalSubject: string;
  title: string;
  verificationStatus: AiVerificationStatus;
  whyUseful: string;
}>;

export type AiFactualClaim = Readonly<{
  evidenceSourceItemIds: readonly string[];
  kind: "sourced_fact" | "interpretation" | "hypothetical_example";
  reviewStatus: "supported" | "needs_review";
  text: string;
}>;

export type AiDraftRequest = Readonly<{
  angle: string;
  draftId: string;
  expectedVersion: number;
  idempotencyKey: string;
  intent: AiDraftIntent;
  subject: string;
}>;

export type AiDraftOutput = Readonly<{
  caption: string;
  evidenceSourceItemIds: readonly string[];
  explanation: string;
  factualClaims: readonly AiFactualClaim[];
  mediaRecommendation: Readonly<{
    altText: string;
    imagePrompt: string;
    path: ContentMediaPath;
    rationale: string;
  }>;
  moderatorNotes: string;
  pollOptions: readonly string[];
  reviewFlags: readonly string[];
  threadPosts: readonly string[];
  title: string;
  verificationStatus: AiVerificationStatus;
  visual: VisualSpecification | null;
}>;

export type AiPreparedPostOutput = Readonly<{
  candidates: readonly AiCreativeCandidate[];
  draft: AiDraftOutput | null;
  idea: AiPreparedIdea | null;
  selectedCandidateIndex: number | null;
  selectionRationale: string;
  worthPublishing: boolean;
}>;

export type AiProviderRequest = Readonly<{
  input: string;
  instructions: string;
  maxOutputTokens: number;
  schema: Readonly<Record<string, unknown>>;
  schemaName: string;
  signal: AbortSignal;
}>;

export type AiProviderResult = Readonly<{
  data: unknown;
  inputTokens: number;
  outputTokens: number;
  responseId: string | null;
}>;

export interface AiTextProvider {
  readonly id: string;
  readonly model: string;
  generateStructured(request: AiProviderRequest): Promise<AiProviderResult>;
}

export type AiRuntimeConfig = Readonly<{
  enabled: boolean;
  inputCostPerMillionUsd: number;
  maxRetries: number;
  model: string;
  monthlyBudgetMicrousd: number;
  outputCostPerMillionUsd: number;
  provider: "openai";
  requestTimeoutMs: number;
}>;

export type AiPublicStatus = Readonly<{
  available: boolean;
  budgetConfigured: boolean;
  model: string;
  reason:
    | "available"
    | "budget_exhausted"
    | "disabled"
    | "invalid_configuration"
    | "missing_key"
    | "status_unavailable"
    | "zero_budget";
}>;

export type AiRunReservation = Readonly<{
  duplicate: boolean;
  runId: string;
}>;

export interface AiRunStore {
  begin(input: Readonly<{
    evidenceIds: readonly string[];
    fingerprint: string;
    idempotencyKey: string;
    kind: "idea_batch" | "draft" | "image";
    model: string;
    monthlyBudgetMicrousd: number;
    ownerId: string;
    provider: string;
    requestedCount: number;
    reservationMicrousd: number;
  }>): Promise<AiRunReservation>;
  complete(input: Readonly<{
    estimatedCostMicrousd: number;
    inputTokens: number;
    outputTokens: number;
    ownerId: string;
    responseId: string | null;
    runId: string;
    suggestions: readonly Readonly<{
      kind: "idea_batch" | "draft" | "image";
      payload: Readonly<Record<string, unknown>>;
      verificationStatus: AiVerificationStatus;
    }>[];
  }>): Promise<void>;
  fail(input: Readonly<{ errorCode: string; ownerId: string; runId: string }>): Promise<void>;
}

export class AiGenerationError extends Error {
  readonly code:
    | "disabled"
    | "invalid_configuration"
    | "invalid_request"
    | "budget_exhausted"
    | "already_running"
    | "duplicate_request"
    | "provider_failure"
    | "provider_timeout"
    | "invalid_output";

  constructor(
    code: AiGenerationError["code"],
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "AiGenerationError";
  }
}
