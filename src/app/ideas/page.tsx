import type { Metadata } from "next";
import { connection } from "next/server";

import { ContentIdeasWorkspace } from "@/components/content/content-ideas-workspace";
import { AiIdeaGenerator } from "@/components/content/ai-idea-generator";
import { OwnerSessionBar } from "@/components/content/owner-session-bar";
import { PageLayout } from "@/components/workspace/page-layout";
import type { EvidenceOption } from "@/features/content-studio/content-types";
import { getSection } from "@/lib/workspace";
import { listContentEvidence } from "@/server/content/list-content-evidence";
import { requireOwnerPage } from "@/server/auth/owner";
import { loadContentWorkspace } from "@/server/content/workspace-repository";
import { listAiIdeaSuggestions } from "@/server/ai/repository";
import { getOwnerAiStatus } from "@/server/ai/status";

export const metadata: Metadata = { title: `${getSection("/ideas").title} | Cloud Engineering Agent` };

export default async function Page() {
  await connection();
  const ownerId = await requireOwnerPage("/ideas");
  const section = getSection("/ideas");
  const [evidenceResult, initialState, aiSuggestions, aiStatus] = await Promise.all([
    listContentEvidence().then((value) => ({ options: [...value] as readonly EvidenceOption[], unavailable: false })).catch(() => {
      console.error("[content-ideas] Optional publisher evidence could not be loaded.");
      return { options: [] as readonly EvidenceOption[], unavailable: true };
    }),
    loadContentWorkspace(ownerId),
    listAiIdeaSuggestions(ownerId),
    getOwnerAiStatus(ownerId),
  ]);
  return (
    <PageLayout title={section.title} description={section.description} eyebrow={section.group}>
      <OwnerSessionBar />
      <AiIdeaGenerator evidenceOptions={evidenceResult.options} initialStatus={aiStatus} initialSuggestions={aiSuggestions} />
      <ContentIdeasWorkspace evidenceOptions={evidenceResult.options} evidenceUnavailable={evidenceResult.unavailable} initialState={initialState} />
    </PageLayout>
  );
}
