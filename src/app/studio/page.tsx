import type { Metadata } from "next";
import { connection } from "next/server";

import { ContentStudioWorkspace } from "@/components/content/content-studio-workspace";
import { OwnerSessionBar } from "@/components/content/owner-session-bar";
import { PageLayout } from "@/components/workspace/page-layout";
import type { EvidenceOption } from "@/features/content-studio/content-types";
import { getSection } from "@/lib/workspace";
import { listContentEvidence } from "@/server/content/list-content-evidence";
import { requireOwnerPage } from "@/server/auth/owner";
import { loadContentWorkspace } from "@/server/content/workspace-repository";
import { getAiPublicStatus } from "@/server/ai/config";

export const metadata: Metadata = { title: `${getSection("/studio").title} | Cloud Engineering Agent` };

export default async function Page({ searchParams }: { searchParams: Promise<{ draft?: string | readonly string[] }> }) {
  await connection();
  const ownerId = await requireOwnerPage("/studio");
  const section = getSection("/studio");
  const draftParam = (await searchParams).draft;
  const initialDraftId = typeof draftParam === "string" && /^draft-[0-9a-f-]{36}$|^starter-draft-[a-z0-9-]+$/.test(draftParam)
    ? draftParam.slice(0, 128)
    : undefined;
  const [evidenceResult, initialState] = await Promise.all([
    listContentEvidence().then((value) => ({ options: [...value] as readonly EvidenceOption[], unavailable: false })).catch(() => {
      console.error("[content-studio] Optional publisher evidence could not be loaded.");
      return { options: [] as readonly EvidenceOption[], unavailable: true };
    }),
    loadContentWorkspace(ownerId),
  ]);
  return (
    <PageLayout title={section.title} description={section.description} eyebrow={section.group}>
      <OwnerSessionBar />
      <ContentStudioWorkspace
        aiStatus={getAiPublicStatus()}
        evidenceOptions={evidenceResult.options}
        evidenceUnavailable={evidenceResult.unavailable}
        initialDraftId={initialDraftId}
        initialState={initialState}
      />
    </PageLayout>
  );
}
