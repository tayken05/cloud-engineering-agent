import { CONTENT_FORMAT_IDS, getContentFormat, type ContentFormatId } from "./content-formats.ts";
import {
  AUDIENCE_LEVELS,
  DRAFT_STATUSES,
  ENGAGEMENT_STYLES,
  IDEA_STATUSES,
  TECHNICAL_CATEGORIES,
  VISUAL_ASPECTS,
  VISUAL_TEMPLATES,
  type ContentDraft,
  type ContentIdea,
  type ContentWorkspaceState,
  type DraftSnapshot,
  type EvidenceReference,
  type VisualSpecification,
} from "./content-types.ts";

export const CONTENT_WORKSPACE_STORAGE_KEY = "cloud-agent-content-workspace-v1";
export const CONTENT_WORKSPACE_MAX_BYTES = 1_000_000;
export const X_POST_CHARACTER_LIMIT = 280;
export const X_POLL_OPTION_LIMIT = 25;

const MAX_IDEAS = 100;
const MAX_DRAFTS = 100;
const MAX_REVISIONS = 20;
const MAX_EVIDENCE = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function member<const T extends readonly string[]>(value: unknown, values: T, fallback: T[number]): T[number] {
  return typeof value === "string" && values.includes(value) ? value as T[number] : fallback;
}

function iso(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? fallback : date.toISOString();
}

function parseEvidence(value: unknown): EvidenceReference[] {
  if (!Array.isArray(value)) return [];
  const result: EvidenceReference[] = [];
  for (const item of value.slice(0, MAX_EVIDENCE)) {
    if (!isRecord(item)) continue;
    const url = text(item.url, 2048);
    if (!url.startsWith("https://")) continue;
    const id = text(item.id, 128);
    const title = text(item.title, 500).trim();
    const publisher = text(item.publisher, 200).trim();
    if (!id || !title || !publisher) continue;
    result.push({
      id,
      publisher,
      publishedAt: item.publishedAt === null ? null : iso(item.publishedAt, "") || null,
      title,
      url,
      verificationLabel: "publisher_record",
    });
  }
  return result;
}

export function createDefaultVisual(title: string, templateId: VisualSpecification["templateId"] = "educational-fact"): VisualSpecification {
  return {
    accent: "blue",
    aspect: "square",
    caption: "One mechanism. Clearly explained.",
    footer: "Cloud Engineering Agent · Educational draft",
    leftLabel: "Input",
    rightLabel: "Outcome",
    subtitle: "Edit the labels so the visual and caption describe the same technical mechanism.",
    templateId,
    title: title || "Cloud engineering, made visual",
  };
}

function parseVisual(value: unknown): VisualSpecification | null {
  if (!isRecord(value)) return null;
  return {
    accent: member(value.accent, ["blue", "cyan", "violet", "amber"] as const, "blue"),
    aspect: member(value.aspect, VISUAL_ASPECTS, "square"),
    caption: text(value.caption, 240),
    footer: text(value.footer, 120),
    leftLabel: text(value.leftLabel, 80),
    rightLabel: text(value.rightLabel, 80),
    subtitle: text(value.subtitle, 280),
    templateId: member(value.templateId, VISUAL_TEMPLATES, "educational-fact"),
    title: text(value.title, 180),
  };
}

function snapshotFrom(value: Record<string, unknown>): DraftSnapshot {
  return {
    caption: text(value.caption, 4000),
    explanation: text(value.explanation, 12_000),
    moderatorNotes: text(value.moderatorNotes, 6000),
    pollOptions: Array.isArray(value.pollOptions) ? value.pollOptions.slice(0, 4).map((item) => text(item, 100)) : [],
    threadPosts: Array.isArray(value.threadPosts) ? value.threadPosts.slice(0, 20).map((item) => text(item, 4000)) : [],
    title: text(value.title, 300),
    visual: parseVisual(value.visual),
  };
}

function parseIdea(value: unknown, fallbackTime: string): ContentIdea | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 128);
  const subject = text(value.subject, 300).trim();
  if (!id || !subject) return null;
  return {
    audience: member(value.audience, AUDIENCE_LEVELS, "mixed"),
    createdAt: iso(value.createdAt, fallbackTime),
    educationalObjective: text(value.educationalObjective, 1000),
    engagementStyle: member(value.engagementStyle, ENGAGEMENT_STYLES, "teach"),
    evidence: parseEvidence(value.evidence),
    formatId: member(value.formatId, CONTENT_FORMAT_IDS, "beginner-friendly-education"),
    id,
    notes: text(value.notes, 4000),
    recordVersion: typeof value.recordVersion === "number" && value.recordVersion > 0 ? Math.floor(value.recordVersion) : 1,
    status: member(value.status, IDEA_STATUSES, "captured"),
    subject,
    technicalCategory: member(value.technicalCategory, TECHNICAL_CATEGORIES, "cloud_engineering"),
    updatedAt: iso(value.updatedAt, fallbackTime),
  };
}

function parseDraft(value: unknown, fallbackTime: string): ContentDraft | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 128);
  if (!id) return null;
  const snapshot = snapshotFrom(value);
  const revisions = Array.isArray(value.revisions) ? value.revisions.slice(-MAX_REVISIONS).flatMap((item) => {
    if (!isRecord(item) || !isRecord(item.snapshot)) return [];
    return [{ id: text(item.id, 128), savedAt: iso(item.savedAt, fallbackTime), snapshot: snapshotFrom(item.snapshot), version: typeof item.version === "number" && item.version > 0 ? Math.floor(item.version) : 1 }];
  }) : [];
  return {
    ...snapshot,
    createdAt: iso(value.createdAt, fallbackTime),
    evidence: parseEvidence(value.evidence),
    formatId: member(value.formatId, CONTENT_FORMAT_IDS, "beginner-friendly-education"),
    id,
    ideaId: typeof value.ideaId === "string" ? value.ideaId.slice(0, 128) : null,
    recordVersion: typeof value.recordVersion === "number" && value.recordVersion > 0 ? Math.floor(value.recordVersion) : 1,
    revisions,
    status: member(value.status, DRAFT_STATUSES, "draft"),
    updatedAt: iso(value.updatedAt, fallbackTime),
  };
}

export function parseContentWorkspace(value: unknown): ContentWorkspaceState | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.ideas) || !Array.isArray(value.drafts)) return null;
  const fallbackTime = "2026-10-15T00:00:00.000Z";
  return {
    drafts: value.drafts.slice(0, MAX_DRAFTS).flatMap((item) => parseDraft(item, fallbackTime) ?? []),
    ideas: value.ideas.slice(0, MAX_IDEAS).flatMap((item) => parseIdea(item, fallbackTime) ?? []),
    version: 1,
  };
}

export function serializeContentWorkspace(state: ContentWorkspaceState): string {
  const serialized = JSON.stringify(state);
  if (new Blob([serialized]).size > CONTENT_WORKSPACE_MAX_BYTES) {
    throw new Error("The device-local content workspace has reached its 1 MB safety limit.");
  }
  return serialized;
}

export function countXCharacters(value: string): number {
  return Array.from(value.normalize("NFC")).length;
}

export function validateDraft(draft: ContentDraft): readonly string[] {
  const problems: string[] = [];
  const format = getContentFormat(draft.formatId);
  if (!draft.title.trim()) problems.push("Add a title or hook.");
  if (!draft.caption.trim() && draft.threadPosts.every((post) => !post.trim())) problems.push("Add a caption or thread post.");
  if (draft.caption && countXCharacters(draft.caption) > X_POST_CHARACTER_LIMIT) problems.push("The main caption exceeds the 280-character preflight limit.");
  draft.threadPosts.forEach((post, index) => {
    if (countXCharacters(post) > X_POST_CHARACTER_LIMIT) problems.push(`Thread post ${index + 1} exceeds the 280-character preflight limit.`);
  });
  if (format.mode === "thread" && draft.threadPosts.filter((post) => post.trim()).length < 2) problems.push("This format needs at least two thread posts.");
  if (format.mode === "poll") {
    const options = draft.pollOptions.filter((option) => option.trim());
    if (options.length < 2 || options.length > 4) problems.push("A poll needs two to four options.");
    if (options.some((option) => countXCharacters(option) > X_POLL_OPTION_LIMIT)) problems.push("Poll options must stay within the 25-character preflight limit.");
  }
  if (draft.formatId === "breaking-technology-updates" && draft.evidence.length === 0) problems.push("Breaking updates require at least one publisher source.");
  if ((draft.formatId === "ask-grok" || draft.formatId === "troubleshooting-challenges") && !draft.moderatorNotes.trim()) problems.push("Add correct-answer or moderator notes before review.");
  return problems;
}

export function createStarterWorkspace(): ContentWorkspaceState {
  const now = "2026-10-15T00:00:00.000Z";
  const ideas: ContentIdea[] = [
    {
      audience: "intermediate", createdAt: now,
      educationalObjective: "Explain why a distributed naming system replaced a centrally maintained host file.",
      engagementStyle: "teach", evidence: [], formatId: "historical-first-principles",
      id: "starter-idea-dns-history", notes: "Evergreen starter. Add primary historical references before publication.",
      recordVersion: 1, status: "approved", subject: "From HOSTS.TXT to the Domain Name System", technicalCategory: "networking", updatedAt: now,
    },
    {
      audience: "beginner", createdAt: now,
      educationalObjective: "Build intuition for routing, security boundaries, and tenancy inside a virtual network.",
      engagementStyle: "discuss", evidence: [], formatId: "real-world-analogies",
      id: "starter-idea-vpc-analogy", notes: "State clearly that the business-park analogy does not model packet forwarding by itself.",
      recordVersion: 1, status: "approved", subject: "A VPC as a gated business park", technicalCategory: "cloud_engineering", updatedAt: now,
    },
    {
      audience: "intermediate", createdAt: now,
      educationalObjective: "Help engineers isolate name-resolution failures before changing unrelated network controls.",
      engagementStyle: "challenge", evidence: [], formatId: "ask-grok",
      id: "starter-idea-dns-challenge", notes: "Use invented example addresses only. Keep the diagnosis in moderator notes.",
      recordVersion: 1, status: "drafted", subject: "The IP works, but the hostname fails", technicalCategory: "networking", updatedAt: now,
    },
  ];
  const drafts: ContentDraft[] = [
    {
      caption: "A server can answer by IP while its hostname still fails. @grok, which layer would you inspect first—and what evidence would confirm it?",
      createdAt: now, evidence: [],
      explanation: "The visual separates reachability from name resolution. The prompt asks for evidence before a configuration change.",
      formatId: "ask-grok", id: "starter-draft-dns-challenge", ideaId: "starter-idea-dns-challenge",
      moderatorNotes: "Expected direction: inspect DNS resolution, resolver configuration, query response, and relevant DNS records. An IP test alone does not validate DNS.",
      pollOptions: [], recordVersion: 1, revisions: [], status: "draft", threadPosts: [], title: "Reachable by IP. Missing by name.", updatedAt: now,
      visual: {
        accent: "cyan", aspect: "landscape", caption: "Where would you look first?",
        footer: "Cloud Engineering Agent · Troubleshooting challenge", leftLabel: "203.0.113.20 responds",
        rightLabel: "app.example.test fails", subtitle: "Network reachability succeeds. Name resolution does not.",
        templateId: "network-troubleshooting", title: "Same service. Different result.",
      },
    },
  ];
  return { drafts, ideas, version: 1 };
}

export function snapshotDraft(draft: ContentDraft): DraftSnapshot {
  return {
    caption: draft.caption,
    explanation: draft.explanation,
    moderatorNotes: draft.moderatorNotes,
    pollOptions: draft.pollOptions,
    threadPosts: draft.threadPosts,
    title: draft.title,
    visual: draft.visual,
  };
}

export function blankDraft(formatId: ContentFormatId, now: string, id: string): ContentDraft {
  const format = getContentFormat(formatId);
  return {
    caption: "", createdAt: now, evidence: [], explanation: "", formatId, id, ideaId: null,
    moderatorNotes: "", pollOptions: format.mode === "poll" ? ["", ""] : [], recordVersion: 1, revisions: [],
    status: "draft", threadPosts: format.mode === "thread" ? ["", ""] : [], title: "", updatedAt: now, visual: null,
  };
}
