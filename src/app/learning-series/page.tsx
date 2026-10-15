import type { Metadata } from "next";
import { LearningSeriesGuide } from "@/components/content/learning-series-guide";
import { PageLayout } from "@/components/workspace/page-layout";
import { getSection } from "@/lib/workspace";

export const metadata: Metadata = { title: `${getSection("/learning-series").title} | Cloud Engineering Agent` };

export default function Page() {
  const section = getSection("/learning-series");
  return (
    <PageLayout title={section.title} description={section.description} eyebrow={section.group}>
      <LearningSeriesGuide />
    </PageLayout>
  );
}
