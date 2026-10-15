import type { Metadata } from "next";
import { connection } from "next/server";

import { ContentIdeasWorkspace } from "@/components/content/content-ideas-workspace";
import { PageLayout } from "@/components/workspace/page-layout";
import type { EvidenceOption } from "@/features/content-studio/content-types";
import { getSection } from "@/lib/workspace";
import { listContentEvidence } from "@/server/content/list-content-evidence";

export const metadata: Metadata = { title: `${getSection("/ideas").title} | Cloud Engineering Agent` };

export default async function Page() {
  await connection();
  const section = getSection("/ideas");
  let evidenceOptions: readonly EvidenceOption[] = [];
  let evidenceUnavailable = false;
  try {
    evidenceOptions = [...await listContentEvidence()];
  } catch {
    evidenceUnavailable = true;
    console.error("[content-ideas] Optional publisher evidence could not be loaded.");
  }
  return (
    <PageLayout title={section.title} description={section.description} eyebrow={section.group}>
      <ContentIdeasWorkspace evidenceOptions={evidenceOptions} evidenceUnavailable={evidenceUnavailable} />
    </PageLayout>
  );
}
