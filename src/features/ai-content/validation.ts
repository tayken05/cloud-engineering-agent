import { createHash } from "node:crypto";

import { CONTENT_FORMAT_IDS, getContentFormat, type ContentFormatId } from "../content-studio/content-formats.ts";
import {
  AUDIENCE_LEVELS,
  ENGAGEMENT_STYLES,
  TECHNICAL_CATEGORIES,
  CONTENT_MEDIA_PATHS,
  VISUAL_ASPECTS,
  VISUAL_TEMPLATES,
  type VisualSpecification,
} from "../content-studio/content-types.ts";
import { countXCharacters, X_POLL_OPTION_LIMIT, X_POST_CHARACTER_LIMIT } from "../content-studio/content-workspace.ts";
import {
  AI_PRESENTATIONS,
  AI_DRAFT_INTENTS,
  AI_RESEARCH_PATHS,
  AI_VERIFICATION_STATUSES,
  AiGenerationError,
  type AiDraftOutput,
  type AiDraftRequest,
  type AiFactualClaim,
  type AiIdeaRequest,
  type AiIdeaSuggestion,
  type AiPreparedPostOutput,
  type AiPreparePostRequest,
} from "./types.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{15,127}$/;
const DRAFT_ID_PATTERN = /^(draft|starter-draft)-[a-z0-9-]+$/;
const SAFE_SERIES_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DANGEROUS_COMMAND = /(?:rm\s+-rf\s+\/|curl\b[^\n|]{0,200}\|\s*(?:ba)?sh\b|wget\b[^\n|]{0,200}\|\s*(?:ba)?sh\b|chmod\s+777\b|mkfs\.|:\(\)\s*\{)/i;
export const FORBIDDEN_TYPOGRAPHIC_DASH = /[\u2013\u2014]/u;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boundedText(value: unknown, max: number, required = true): string | null {
  if (typeof value !== "string") return required ? null : "";
  const result = value.trim().slice(0, max);
  return required && !result ? null : result;
}

function member<const T extends readonly string[]>(value: unknown, values: T): T[number] | null {
  return typeof value === "string" && values.includes(value) ? value as T[number] : null;
}

function stringArray(value: unknown, limit: number, itemLimit: number): string[] | null {
  if (!Array.isArray(value) || value.length > limit) return null;
  const items = value.map((item) => boundedText(item, itemLimit)).filter((item): item is string => Boolean(item));
  return items.length === value.length ? items : null;
}

function evidenceIds(value: unknown, allowed: ReadonlySet<string>): string[] | null {
  const ids = stringArray(value, 12, 128);
  if (!ids || ids.some((id) => !UUID_PATTERN.test(id) || !allowed.has(id))) return null;
  return [...new Set(ids)];
}

function visual(value: unknown): VisualSpecification | null | undefined {
  if (value === null) return null;
  const item = record(value);
  if (!item) return undefined;
  const templateId = member(item.templateId, VISUAL_TEMPLATES);
  const aspect = member(item.aspect, VISUAL_ASPECTS);
  const accent = member(item.accent, ["blue", "cyan", "violet", "amber"] as const);
  const title = boundedText(item.title, 180);
  const subtitle = boundedText(item.subtitle, 280, false);
  const caption = boundedText(item.caption, 240, false);
  const footer = boundedText(item.footer, 120, false);
  const leftLabel = boundedText(item.leftLabel, 80, false);
  const rightLabel = boundedText(item.rightLabel, 80, false);
  if (!templateId || !aspect || !accent || !title || subtitle === null || caption === null || footer === null || leftLabel === null || rightLabel === null) return undefined;
  return { accent, aspect, caption, footer, leftLabel, rightLabel, subtitle, templateId, title };
}

export function validateIdeaRequest(value: unknown): AiIdeaRequest {
  const item = record(value);
  if (!item) throw new AiGenerationError("invalid_request", "The idea request is invalid.");
  const researchPath = member(item.researchPath, AI_RESEARCH_PATHS);
  const topic = boundedText(item.topic, 200, false);
  const contentObjective = boundedText(item.contentObjective, 500, false);
  const batchSize = typeof item.batchSize === "number" ? Math.floor(item.batchSize) : 0;
  const idempotencyKey = boundedText(item.idempotencyKey, 128);
  const formatId = item.formatId === null ? null : member(item.formatId, CONTENT_FORMAT_IDS);
  const audience = item.audience === null ? null : member(item.audience, AUDIENCE_LEVELS);
  if (!researchPath || topic === null || contentObjective === null || batchSize < 3 || batchSize > 5 || !idempotencyKey || !IDEMPOTENCY_PATTERN.test(idempotencyKey) || (item.formatId !== null && !formatId) || (item.audience !== null && !audience)) {
    throw new AiGenerationError("invalid_request", "Request 3–5 ideas with valid bounded filters.");
  }
  return { audience, batchSize, contentObjective, formatId, idempotencyKey, researchPath, topic };
}

export function validatePreparePostRequest(value: unknown): AiPreparePostRequest {
  const item = record(value);
  if (!item) throw new AiGenerationError("invalid_request", "The Prepare a Post request is invalid.");
  const direction = boundedText(item.direction, 500, false);
  const idempotencyKey = boundedText(item.idempotencyKey, 128);
  if (direction === null || !idempotencyKey || !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
    throw new AiGenerationError("invalid_request", "The Prepare a Post request is invalid.");
  }
  return { direction, idempotencyKey };
}

export function validateDraftRequest(value: unknown): AiDraftRequest {
  const item = record(value);
  if (!item) throw new AiGenerationError("invalid_request", "The draft request is invalid.");
  const draftId = boundedText(item.draftId, 128);
  const angle = boundedText(item.angle, 500, false);
  const idempotencyKey = boundedText(item.idempotencyKey, 128);
  const expectedVersion = typeof item.expectedVersion === "number" ? Math.floor(item.expectedVersion) : 0;
  const intent = member(item.intent, AI_DRAFT_INTENTS);
  const subject = boundedText(item.subject, 300, false);
  if (!draftId || !DRAFT_ID_PATTERN.test(draftId) || angle === null || !idempotencyKey || !IDEMPOTENCY_PATTERN.test(idempotencyKey) || expectedVersion < 1 || !intent || subject === null || (intent === "new_subject" && !subject)) {
    throw new AiGenerationError("invalid_request", "The draft request is invalid.");
  }
  return { angle, draftId, expectedVersion, idempotencyKey, intent, subject };
}

function containsForbiddenDash(value: unknown): boolean {
  if (typeof value === "string") return FORBIDDEN_TYPOGRAPHIC_DASH.test(value);
  if (Array.isArray(value)) return value.some(containsForbiddenDash);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some(containsForbiddenDash);
  return false;
}

export function validateIdeaSuggestions(value: unknown, allowedEvidence: ReadonlySet<string>, expectedCount: number): AiIdeaSuggestion[] {
  const root = record(value);
  if (!root || !Array.isArray(root.ideas) || root.ideas.length !== expectedCount) throw new AiGenerationError("invalid_output", "The provider returned an invalid idea batch.");
  const suggestions = root.ideas.map((candidate): AiIdeaSuggestion | null => {
    const item = record(candidate);
    if (!item) return null;
    const title = boundedText(item.title, 300);
    const technicalSubject = boundedText(item.technicalSubject, 300);
    const formatId = member(item.formatId, CONTENT_FORMAT_IDS);
    const audience = member(item.audience, AUDIENCE_LEVELS);
    const technicalCategory = member(item.technicalCategory, TECHNICAL_CATEGORIES);
    const educationalObjective = boundedText(item.educationalObjective, 1000);
    const whyUseful = boundedText(item.whyUseful, 1000);
    const contentAngle = boundedText(item.contentAngle, 1200);
    const engagementStyle = member(item.engagementStyle, ENGAGEMENT_STYLES);
    const recommendedPresentation = member(item.recommendedPresentation, AI_PRESENTATIONS);
    const verificationStatus = member(item.verificationStatus, AI_VERIFICATION_STATUSES);
    const ids = evidenceIds(item.evidenceSourceItemIds, allowedEvidence);
    const reviewFlags = stringArray(item.reviewFlags, 12, 300);
    const suggestedVisual = visual(item.suggestedVisual);
    const seriesKey = item.seriesKey === null ? null : boundedText(item.seriesKey, 100);
    const seriesPosition = item.seriesPosition === null ? null : typeof item.seriesPosition === "number" ? Math.floor(item.seriesPosition) : NaN;
    if (!title || !technicalSubject || !formatId || !audience || !technicalCategory || !educationalObjective || !whyUseful || !contentAngle || !engagementStyle || !recommendedPresentation || !verificationStatus || !ids || !reviewFlags || suggestedVisual === undefined || containsForbiddenDash(item) || (seriesKey !== null && (!seriesKey || !SAFE_SERIES_KEY.test(seriesKey))) || (seriesPosition !== null && (!Number.isInteger(seriesPosition) || seriesPosition < 1 || seriesPosition > 999))) return null;
    const flags = [...reviewFlags];
    let safeStatus = verificationStatus;
    if (ids.length === 0 || (formatId === "historical-first-principles" && ids.length < 1)) {
      safeStatus = "needs_review";
      if (!flags.includes("Supporting evidence requires editorial verification.")) flags.push("Supporting evidence requires editorial verification.");
    }
    if (formatId === "real-world-analogies" && !/limit|break|does not|isn't|not model/i.test(`${contentAngle} ${educationalObjective}`)) {
      safeStatus = "needs_review";
      flags.push("The analogy needs an explicit statement of its limits.");
    }
    return { audience, contentAngle, educationalObjective, engagementStyle, evidenceSourceItemIds: ids, formatId, recommendedPresentation, reviewFlags: flags.slice(0, 12), seriesKey, seriesPosition, suggestedVisual, technicalCategory, technicalSubject, title, verificationStatus: safeStatus, whyUseful };
  });
  if (suggestions.some((item) => item === null)) throw new AiGenerationError("invalid_output", "The provider returned malformed idea fields.");
  return suggestions as AiIdeaSuggestion[];
}

function factualClaims(value: unknown, allowedEvidence: ReadonlySet<string>): AiFactualClaim[] | null {
  if (!Array.isArray(value) || value.length > 30) return null;
  const result: AiFactualClaim[] = [];
  for (const candidate of value) {
    const item = record(candidate);
    if (!item) return null;
    const text = boundedText(item.text, 1000);
    const kind = member(item.kind, ["sourced_fact", "interpretation", "hypothetical_example"] as const);
    let reviewStatus = member(item.reviewStatus, ["supported", "needs_review"] as const);
    const ids = evidenceIds(item.evidenceSourceItemIds, allowedEvidence);
    if (!text || !kind || !reviewStatus || !ids) return null;
    if (kind === "sourced_fact" && ids.length === 0) reviewStatus = "needs_review";
    result.push({ evidenceSourceItemIds: ids, kind, reviewStatus, text });
  }
  return result;
}

export function validateDraftOutput(value: unknown, formatId: ContentFormatId, allowedEvidence: ReadonlySet<string>): AiDraftOutput {
  const item = record(value);
  if (!item) throw new AiGenerationError("invalid_output", "The provider returned an invalid draft.");
  const title = boundedText(item.title, 300);
  const caption = boundedText(item.caption, 4000, false);
  const explanation = boundedText(item.explanation, 12_000);
  const moderatorNotes = boundedText(item.moderatorNotes, 6000, false);
  const threadPosts = stringArray(item.threadPosts, 20, 4000);
  const pollOptions = stringArray(item.pollOptions, 4, 100);
  const ids = evidenceIds(item.evidenceSourceItemIds, allowedEvidence);
  const claims = factualClaims(item.factualClaims, allowedEvidence);
  const reviewFlags = stringArray(item.reviewFlags, 20, 300);
  const verificationStatus = member(item.verificationStatus, AI_VERIFICATION_STATUSES);
  const visualSpec = visual(item.visual);
  const media = record(item.mediaRecommendation);
  const mediaPath = media ? member(media.path, CONTENT_MEDIA_PATHS) : null;
  const rationale = media ? boundedText(media.rationale, 1000) : null;
  const imagePrompt = media ? boundedText(media.imagePrompt, 4000, false) : null;
  const altText = media ? boundedText(media.altText, 1000, false) : null;
  if (!title || caption === null || !explanation || moderatorNotes === null || !threadPosts || !pollOptions || !ids || !claims || !reviewFlags || !verificationStatus || visualSpec === undefined || !mediaPath || !rationale || imagePrompt === null || altText === null || (mediaPath !== "text_only" && (!imagePrompt || !altText)) || containsForbiddenDash(item)) throw new AiGenerationError("invalid_output", "The provider returned malformed draft fields.");
  const flags = [...reviewFlags];
  let safeStatus = verificationStatus;
  const format = getContentFormat(formatId);
  if (caption && countXCharacters(caption) > X_POST_CHARACTER_LIMIT) flags.push("The standalone caption exceeds 280 characters.");
  if (threadPosts.some((post) => countXCharacters(post) > X_POST_CHARACTER_LIMIT)) flags.push("One or more thread posts exceed 280 characters.");
  if (format.mode === "thread" && threadPosts.length < 2) flags.push("The selected format requires at least two thread posts.");
  if (format.mode === "poll" && (pollOptions.length < 2 || pollOptions.some((option) => countXCharacters(option) > X_POLL_OPTION_LIMIT))) flags.push("The poll requires 2–4 options of at most 25 characters.");
  if (DANGEROUS_COMMAND.test(`${caption}\n${explanation}\n${threadPosts.join("\n")}`)) flags.push("A potentially destructive command requires manual technical review.");
  if (claims.some((claim) => claim.reviewStatus === "needs_review") || ids.length === 0 || flags.length > 0) safeStatus = "needs_review";
  if (formatId === "historical-first-principles" && ids.length === 0) flags.push("Historical chronology lacks supporting evidence.");
  if (formatId === "real-world-analogies" && !/limit|break|does not|isn't|not model/i.test(`${explanation} ${moderatorNotes}`)) flags.push("The analogy does not state where it stops matching the mechanism.");
  return { caption, evidenceSourceItemIds: ids, explanation, factualClaims: claims, mediaRecommendation: { altText, imagePrompt, path: mediaPath, rationale }, moderatorNotes, pollOptions, reviewFlags: [...new Set(flags)].slice(0, 20), threadPosts, title, verificationStatus: safeStatus, visual: visualSpec };
}

export function validatePreparedPostOutput(value: unknown, allowedEvidence: ReadonlySet<string>): AiPreparedPostOutput {
  const item = record(value);
  const selectionRationale = boundedText(item?.selectionRationale, 1200);
  if (!item || item.worthPublishing !== true || !selectionRationale) {
    throw new AiGenerationError("invalid_output", "The provider did not identify a worthwhile publishable premise.");
  }
  const idea = validateIdeaSuggestions({ ideas: [item.idea] }, allowedEvidence, 1)[0];
  if (!idea) throw new AiGenerationError("invalid_output", "The provider did not return a valid selected idea.");
  const draft = validateDraftOutput(item.draft, idea.formatId, allowedEvidence);
  return { draft, idea, selectionRationale, worthPublishing: true };
}

function normalizedWords(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 2));
}

export function isNearDuplicate(candidate: string, existing: readonly string[]): boolean {
  const left = normalizedWords(candidate);
  if (left.size === 0) return true;
  return existing.some((value) => {
    const right = normalizedWords(value);
    const intersection = [...left].filter((word) => right.has(word)).length;
    const union = new Set([...left, ...right]).size;
    return union > 0 && intersection / union >= 0.72;
  });
}

export function requestFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function ideaOutputSchema() {
  const visualSchema = { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["templateId", "aspect", "accent", "title", "subtitle", "caption", "footer", "leftLabel", "rightLabel"], properties: { templateId: { type: "string", enum: [...VISUAL_TEMPLATES] }, aspect: { type: "string", enum: [...VISUAL_ASPECTS] }, accent: { type: "string", enum: ["blue", "cyan", "violet", "amber"] }, title: { type: "string" }, subtitle: { type: "string" }, caption: { type: "string" }, footer: { type: "string" }, leftLabel: { type: "string" }, rightLabel: { type: "string" } } }] };
  return { type: "object", additionalProperties: false, required: ["ideas"], properties: { ideas: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["title", "technicalSubject", "technicalCategory", "formatId", "audience", "educationalObjective", "engagementStyle", "whyUseful", "contentAngle", "evidenceSourceItemIds", "verificationStatus", "recommendedPresentation", "suggestedVisual", "reviewFlags", "seriesKey", "seriesPosition"], properties: { title: { type: "string" }, technicalSubject: { type: "string" }, technicalCategory: { type: "string", enum: [...TECHNICAL_CATEGORIES] }, formatId: { type: "string", enum: [...CONTENT_FORMAT_IDS] }, audience: { type: "string", enum: [...AUDIENCE_LEVELS] }, educationalObjective: { type: "string" }, engagementStyle: { type: "string", enum: [...ENGAGEMENT_STYLES] }, whyUseful: { type: "string" }, contentAngle: { type: "string" }, evidenceSourceItemIds: { type: "array", items: { type: "string" }, maxItems: 12 }, verificationStatus: { type: "string", enum: [...AI_VERIFICATION_STATUSES] }, recommendedPresentation: { type: "string", enum: [...AI_PRESENTATIONS] }, suggestedVisual: visualSchema, reviewFlags: { type: "array", items: { type: "string" }, maxItems: 12 }, seriesKey: { anyOf: [{ type: "null" }, { type: "string" }] }, seriesPosition: { anyOf: [{ type: "null" }, { type: "integer" }] } } } } } } as const;
}

export function draftOutputSchema() {
  const ideaSchema = ideaOutputSchema();
  const visualSchema = ((ideaSchema.properties.ideas.items.properties.suggestedVisual) as Readonly<Record<string, unknown>>);
  return { type: "object", additionalProperties: false, required: ["title", "caption", "explanation", "moderatorNotes", "threadPosts", "pollOptions", "evidenceSourceItemIds", "verificationStatus", "factualClaims", "reviewFlags", "visual", "mediaRecommendation"], properties: { title: { type: "string" }, caption: { type: "string" }, explanation: { type: "string" }, moderatorNotes: { type: "string" }, threadPosts: { type: "array", items: { type: "string" }, maxItems: 20 }, pollOptions: { type: "array", items: { type: "string" }, maxItems: 4 }, evidenceSourceItemIds: { type: "array", items: { type: "string" }, maxItems: 12 }, verificationStatus: { type: "string", enum: [...AI_VERIFICATION_STATUSES] }, factualClaims: { type: "array", maxItems: 30, items: { type: "object", additionalProperties: false, required: ["text", "kind", "evidenceSourceItemIds", "reviewStatus"], properties: { text: { type: "string" }, kind: { type: "string", enum: ["sourced_fact", "interpretation", "hypothetical_example"] }, evidenceSourceItemIds: { type: "array", items: { type: "string" }, maxItems: 12 }, reviewStatus: { type: "string", enum: ["supported", "needs_review"] } } } }, reviewFlags: { type: "array", items: { type: "string" }, maxItems: 20 }, visual: visualSchema, mediaRecommendation: { type: "object", additionalProperties: false, required: ["path", "rationale", "imagePrompt", "altText"], properties: { path: { type: "string", enum: [...CONTENT_MEDIA_PATHS] }, rationale: { type: "string" }, imagePrompt: { type: "string" }, altText: { type: "string" } } } } } as const;
}

export function preparedPostOutputSchema() {
  const ideas = ideaOutputSchema();
  return {
    type: "object",
    additionalProperties: false,
    required: ["worthPublishing", "selectionRationale", "idea", "draft"],
    properties: {
      worthPublishing: { type: "boolean" },
      selectionRationale: { type: "string" },
      idea: ideas.properties.ideas.items,
      draft: draftOutputSchema(),
    },
  } as const;
}
