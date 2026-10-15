import Link from "next/link";

const styles = [
  {
    badge: "Style A",
    title: "Historical Evolution & First Principles",
    description: "Trace a technology from the human problem through early mechanisms, their limits, and the reasons modern systems emerged.",
    steps: ["Original human problem", "Earliest practical solutions", "How the mechanism worked", "Limitations", "Pressure for change", "Modern technology"],
  },
  {
    badge: "Style B",
    title: "Real-World Analogies",
    description: "Use a familiar physical system to build intuition, then state exactly where the analogy stops matching the technical mechanism.",
    steps: ["Familiar physical system", "Explicit concept mapping", "Useful intuition", "Boundary of the analogy", "Return to the real mechanism"],
  },
] as const;

export function LearningSeriesGuide() {
  return (
    <div className="content-workspace">
      <aside className="operator-notice"><div><strong>Two independent teaching styles</strong><p>Choose the style that serves the lesson. Neither category replaces or subsumes the other.</p></div><span className="status-chip status-safe">Preserved</span></aside>
      <div className="learning-style-grid">
        {styles.map((style) => (
          <article className="studio-panel" key={style.badge}>
            <span className="status-chip">{style.badge}</span>
            <h2>{style.title}</h2>
            <p>{style.description}</p>
            <ol>{style.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            <Link className="primary-action inline-action" href="/ideas">Develop an idea</Link>
          </article>
        ))}
      </div>
      <section className="studio-panel">
        <p className="eyebrow">Series workflow</p>
        <h2>Build a reusable lesson sequence</h2>
        <p className="studio-intro">Capture the educational objective in Content Ideas, approve it, create a draft in the Studio, add evidence and moderator notes, then mark it ready for future human review. No X account is connected.</p>
      </section>
    </div>
  );
}
