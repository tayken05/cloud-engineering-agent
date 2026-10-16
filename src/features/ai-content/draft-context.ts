import type { ContentDraft, ContentIdea } from "../content-studio/content-types.ts";
import { AiGenerationError, type AiDraftIntent } from "./types.ts";

export function prepareDraftGenerationContext(input: Readonly<{
  draft: ContentDraft;
  idea: ContentIdea | null;
  intent: AiDraftIntent;
  requestedSubject: string;
}>): Readonly<{ draft: ContentDraft; idea: ContentIdea | null; subject: string }> {
  const idea = input.intent === "develop_current" ? input.idea : null;
  const subject = input.intent === "new_subject" ? input.requestedSubject.trim() : (idea?.subject ?? input.draft.title.trim());
  if (!subject) throw new AiGenerationError("invalid_request", "Choose a specific subject before asking AI to develop this draft.");
  if (input.intent === "develop_current") return { draft: input.draft, idea, subject };
  return {
    draft: { ...input.draft, caption: "", explanation: "", ideaId: null, imageAltText: "", imagePrompt: "", mediaPath: "text_only", moderatorNotes: "", pollOptions: [], threadPosts: [], title: subject, visual: null },
    idea: null,
    subject,
  };
}
