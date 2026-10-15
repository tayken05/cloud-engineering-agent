import type { ContentFormatId } from "./content-formats.ts";

export const TECHNICAL_CATEGORIES = [
  "cloud_engineering", "software_engineering", "linux", "networking", "devops",
  "cybersecurity", "artificial_intelligence", "developer_tools", "open_source",
  "technology_communities", "containers_kubernetes", "infrastructure_as_code",
  "ai_infrastructure", "engineering_careers",
] as const;

export const AUDIENCE_LEVELS = ["beginner", "intermediate", "advanced", "mixed"] as const;
export const IDEA_STATUSES = ["captured", "approved", "drafted", "archived"] as const;
export const DRAFT_STATUSES = ["draft", "ready_for_review"] as const;
export const ENGAGEMENT_STYLES = ["teach", "discuss", "challenge", "ask", "entertain"] as const;
export const VISUAL_TEMPLATES = [
  "cloud-architecture",
  "network-troubleshooting",
  "educational-fact",
  "technical-comparison",
  "question-answer",
  "visual-analogy",
] as const;
export const VISUAL_ASPECTS = ["square", "landscape"] as const;

export type AudienceLevel = (typeof AUDIENCE_LEVELS)[number];
export type IdeaStatus = (typeof IDEA_STATUSES)[number];
export type DraftStatus = (typeof DRAFT_STATUSES)[number];
export type EngagementStyle = (typeof ENGAGEMENT_STYLES)[number];
export type VisualTemplateId = (typeof VISUAL_TEMPLATES)[number];
export type VisualAspect = (typeof VISUAL_ASPECTS)[number];
export type TechnicalCategory = (typeof TECHNICAL_CATEGORIES)[number];

export type EvidenceReference = Readonly<{
  id: string;
  publisher: string;
  publishedAt: string | null;
  title: string;
  url: string;
  verificationLabel: "publisher_record";
}>;

export type EvidenceOption = EvidenceReference;

export type ContentIdea = Readonly<{
  audience: AudienceLevel;
  createdAt: string;
  educationalObjective: string;
  engagementStyle: EngagementStyle;
  evidence: readonly EvidenceReference[];
  formatId: ContentFormatId;
  id: string;
  notes: string;
  recordVersion: number;
  status: IdeaStatus;
  subject: string;
  technicalCategory: TechnicalCategory;
  updatedAt: string;
}>;

export type VisualSpecification = Readonly<{
  accent: "blue" | "cyan" | "violet" | "amber";
  aspect: VisualAspect;
  caption: string;
  footer: string;
  leftLabel: string;
  rightLabel: string;
  subtitle: string;
  templateId: VisualTemplateId;
  title: string;
}>;

export type DraftSnapshot = Readonly<{
  caption: string;
  explanation: string;
  moderatorNotes: string;
  pollOptions: readonly string[];
  threadPosts: readonly string[];
  title: string;
  visual: VisualSpecification | null;
}>;

export type DraftRevision = Readonly<{
  id: string;
  savedAt: string;
  snapshot: DraftSnapshot;
  version: number;
}>;

export type ContentDraft = Readonly<{
  caption: string;
  createdAt: string;
  evidence: readonly EvidenceReference[];
  explanation: string;
  formatId: ContentFormatId;
  id: string;
  ideaId: string | null;
  moderatorNotes: string;
  pollOptions: readonly string[];
  recordVersion: number;
  revisions: readonly DraftRevision[];
  status: DraftStatus;
  threadPosts: readonly string[];
  title: string;
  updatedAt: string;
  visual: VisualSpecification | null;
}>;

export type ContentWorkspaceState = Readonly<{
  drafts: readonly ContentDraft[];
  ideas: readonly ContentIdea[];
  version: 1;
}>;
