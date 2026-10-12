import Link from "next/link";
import { Icon } from "@/components/workspace/icon";
import { PageLayout } from "@/components/workspace/page-layout";
const pillars = [
  {
    title: "Technology Research & Intelligence",
    kind: "research",
    description: "Follow the developments that matter, with trusted sources and verified context.",
    href: "/trending",
    link: "Explore intelligence",
    secondary: "/sources",
    secondaryLabel: "Manage sources"
  },
  {
    title: "Educational Content Creation",
    kind: "create",
    description: "Turn engineering knowledge into clear lessons, practical explanations, and thoughtful content.",
    href: "/studio",
    link: "Open content studio",
    secondary: "/learning-series",
    secondaryLabel: "Explore learning series"
  },
  {
    title: "X Engagement & Analytics",
    kind: "engage",
    description: "Organize conversations and understand the impact of human-reviewed content.",
    href: "/inbox",
    link: "Open inbox",
    secondary: "/analytics",
    secondaryLabel: "View analytics"
  },
  {
    title: "Personal Tech Intelligence Hub",
    kind: "hub",
    description: "A future private space for the wider industry: personalized research, bookmarks, and digests.",
    href: "/tech-hub",
    link: "Explore your tech hub",
    secondary: "/stories",
    secondaryLabel: "Browse stories & news"
  },
] as const;
export default function Home() {
  return (
    <PageLayout
      title="Your engineering workspace"
      description="A focused space to research technology, teach cloud engineering, and build meaningful conversations."
      eyebrow="Dashboard"
    >
      <div className="foundation-notice">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <strong>The foundation is ready. Your integrations are next.</strong>
          <p>No research collection, AI processing, or X activity is running. Explore the workspace below.</p>
        </div>
        <span className="badge">Not connected yet</span>
      </div>
      <section aria-labelledby="areas-title">
        <div className="section-heading">
          <h2 id="areas-title">Four areas. One focused workspace.</h2>
          <p>Choose where to start exploring.</p>
        </div>
        <div className="pillar-grid">
          {pillars.map((pillar, index) => (
            <article className="pillar-card" key={pillar.href}>
              <div className="card-top">
                <span className="pillar-icon"><Icon kind={pillar.kind} /></span>
                <span className="card-number">0{index + 1}</span>
              </div>
              <h3>{pillar.title}</h3>
              <p>{pillar.description}</p>
              <span className="phase-label">Coming in a future phase</span>
              <div className="card-links">
                <Link className="text-link" href={pillar.href}>
                  {pillar.link}<Icon kind="arrow" />
                </Link>
                <Link className="secondary-link" href={pillar.secondary}>{pillar.secondaryLabel}</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="teaching-note" aria-labelledby="teaching-title">
        <div>
          <p className="eyebrow">Built around understanding</p>
          <h2 id="teaching-title">Two independent ways to teach.</h2>
          <p>Trace the history and first principles behind a technology, or explain it through a real-world analogy. Both teaching styles will have their own place.</p>
        </div>
        <Link className="button-link" href="/learning-series">Learning Series <Icon kind="arrow" /></Link>
      </section>
    </PageLayout>
  );
}
