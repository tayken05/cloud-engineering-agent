import type { Metadata } from "next";
import { connection } from "next/server";

import { ContentIdeasWorkspace } from "@/components/content/content-ideas-workspace";
import { OwnerSessionBar } from "@/components/content/owner-session-bar";
import { PageLayout } from "@/components/workspace/page-layout";
import type { EvidenceOption } from "@/features/content-studio/content-types";
import { getSection } from "@/lib/workspace";
import { listContentEvidence } from "@/server/content/list-content-evidence";
import { requireOwnerPage } from "@/server/auth/owner";
import { loadContentWorkspace } from "@/server/content/workspace-repository";

export const metadata: Metadata = { title: `${getSection("/ideas").title} | Cloud Engineering Agent` };

export default async function Page() {
  await connection();
  const ownerId = await requireOwnerPage("/ideas");
  const section = getSection("/ideas");
  let evidenceOptions: readonly EvidenceOption[] = [];
  let evidenceUnavailable = false;
  try {
    evidenceOptions = [...await listContentEvidence()];
  } catch {
    evidenceUnavailable = true;
    console.error("[content-ideas] Optional publisher evidence could not be loaded.");
  }
  const initialState = await loadContentWorkspace(ownerId);
  return (
    <PageLayout title={section.title} description={section.description} eyebrow={section.group}>
      <OwnerSessionBar />
      <ContentIdeasWorkspace evidenceOptions={evidenceOptions} evidenceUnavailable={evidenceUnavailable} initialState={initialState} />
    </PageLayout>
  );
}
