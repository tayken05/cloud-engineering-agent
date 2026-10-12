import Link from "next/link";
import { getSection, type WorkspacePath } from "@/lib/workspace";
import { Icon } from "./icon";
import { PageLayout } from "./page-layout";

export function FeaturePage({ path }: { path: WorkspacePath }) {
  const section = getSection(path);

  return (
    <PageLayout title={section.title} description={section.description} eyebrow={section.group}>
      <section className="empty-state" aria-labelledby="empty-title">
        <span className="empty-icon"><Icon kind="hub" /></span>
        <span className="badge">Coming in a future phase</span>
        <h2 id="empty-title">{section.empty}</h2>
        <p>{section.detail}</p>
        <Link className="text-link" href="/">Back to dashboard <Icon kind="arrow" /></Link>
      </section>
      <div className="scope-note">
        <strong>Workspace preview</strong>
        <p>This page provides navigation and a place for future features. No connected services or live data are available.</p>
      </div>
    </PageLayout>
  );
}
