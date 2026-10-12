import type { Metadata } from "next";
import { FeaturePage } from "@/components/workspace/feature-page";
import { getSection } from "@/lib/workspace";

export const metadata: Metadata = { title: `${getSection("/ideas").title} | Cloud Engineering Agent` };

export default function Page() {
  return <FeaturePage path="/ideas" />;
}
