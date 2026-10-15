export const CONTENT_FORMATS = [
  {
    id: "historical-first-principles",
    label: "Historical Evolution & First Principles",
    mode: "thread",
    guidance: "Begin with the original human problem, show early mechanisms and limits, then connect each change to the modern system.",
    template: ["Original problem", "Earliest practical solution", "How it worked", "Limitations", "What changed next", "Modern mechanism"],
  },
  {
    id: "real-world-analogies",
    label: "Real-World Analogies",
    mode: "single",
    guidance: "Map a technical mechanism to a familiar physical system, state where the analogy breaks, and return to the real mechanism.",
    template: ["Familiar scene", "Concept mapping", "Mechanism", "Where the analogy stops", "Technical takeaway"],
  },
  {
    id: "things-you-probably-didnt-know",
    label: "Things You Probably Didn't Know",
    mode: "single",
    guidance: "Lead with one surprising, verifiable detail and explain why it matters without exaggeration.",
    template: ["Surprising fact", "Evidence", "Mechanism", "Practical meaning"],
  },
  {
    id: "breaking-technology-updates",
    label: "Breaking Technology Updates",
    mode: "single",
    guidance: "State what changed, cite the original publisher, separate confirmed facts from interpretation, and avoid unsupported urgency.",
    template: ["Confirmed change", "Who announced it", "Impact", "What remains unknown", "Original source"],
  },
  {
    id: "beginner-friendly-education",
    label: "Beginner-Friendly Education",
    mode: "single",
    guidance: "Define one concept in plain language, show a small example, and finish with one accurate mental model.",
    template: ["Plain-language definition", "Small example", "Common confusion", "Takeaway"],
  },
  {
    id: "deep-technical-education",
    label: "Deep Technical Education",
    mode: "thread",
    guidance: "Explain internals, constraints, tradeoffs, and failure modes for an experienced engineering audience.",
    template: ["System boundary", "Internal mechanism", "Tradeoffs", "Failure modes", "Operational guidance"],
  },
  {
    id: "practical-tutorials",
    label: "Practical Tutorials",
    mode: "thread",
    guidance: "Set prerequisites and a safe goal, present reproducible steps, and include verification and rollback guidance.",
    template: ["Goal", "Prerequisites", "Steps", "Verification", "Cleanup or rollback"],
  },
  {
    id: "troubleshooting-challenges",
    label: "Troubleshooting Challenges",
    mode: "single",
    guidance: "Provide observable symptoms and enough evidence to reason, while keeping the answer in moderator notes until reveal time.",
    template: ["Scenario", "Symptoms", "Evidence", "Question", "Moderator answer"],
  },
  {
    id: "architecture-discussions",
    label: "Architecture Discussions",
    mode: "single",
    guidance: "Define requirements and constraints before comparing design choices and their operational consequences.",
    template: ["Requirements", "Constraints", "Design", "Tradeoffs", "Discussion prompt"],
  },
  {
    id: "ask-grok",
    label: "Ask Grok",
    mode: "single",
    guidance: "Prepare a factual visual prompt and editable @grok caption. Keep the correct answer in moderator notes and never imply a response exists.",
    template: ["Visual evidence", "Question for @grok", "What engineers should assess", "Moderator notes", "Follow-up invitation"],
  },
  {
    id: "myths-vs-facts",
    label: "Myths vs Facts",
    mode: "single",
    guidance: "Quote the misconception fairly, replace it with a sourced fact, and explain the condition that causes confusion.",
    template: ["Myth", "Fact", "Why the myth persists", "Boundary or exception"],
  },
  {
    id: "tech-humor-memes",
    label: "Tech Humor & Memes",
    mode: "single",
    guidance: "Use a recognizable engineering situation without presenting the joke as technical guidance or targeting individuals.",
    template: ["Relatable setup", "Technical tension", "Punchline", "Optional accurate footnote"],
  },
  {
    id: "polls-interactive-questions",
    label: "Polls & Interactive Questions",
    mode: "poll",
    guidance: "Ask one neutral question with distinct options. Avoid treating an informal poll as representative research.",
    template: ["Question", "Two to four options", "Context", "Planned result discussion"],
  },
  {
    id: "engineering-observations",
    label: "Engineering Observations",
    mode: "single",
    guidance: "Frame an observed pattern with its context and limits instead of turning experience into a universal rule.",
    template: ["Observation", "Context", "Why it may happen", "Limits", "Question to peers"],
  },
  {
    id: "careers-opportunities",
    label: "Careers & Opportunities",
    mode: "single",
    guidance: "Use verified opportunity data, preserve geographic restrictions, and link to the official employer application path.",
    template: ["Role or lesson", "Who it suits", "Verified location", "Requirements", "Official source"],
  },
  {
    id: "projects-hands-on-challenges",
    label: "Projects & Hands-On Challenges",
    mode: "thread",
    guidance: "Define an achievable build, constraints, evidence of completion, and optional extensions without hiding required costs.",
    template: ["Build goal", "Constraints", "Acceptance checks", "Hints", "Extensions"],
  },
  {
    id: "technical-comparisons",
    label: "Technical Comparisons",
    mode: "single",
    guidance: "Compare technologies against the same criteria and workload rather than declaring a universal winner.",
    template: ["Decision context", "Shared criteria", "Option A", "Option B", "When each fits"],
  },
  {
    id: "visual-education",
    label: "Visual Education",
    mode: "single",
    guidance: "Let the visual carry one accurate mechanism; keep labels, arrows, legend, and caption consistent.",
    template: ["Learning objective", "Diagram elements", "Connections", "Legend", "Caption"],
  },
  {
    id: "community-engagement",
    label: "Community Engagement",
    mode: "single",
    guidance: "Invite experience-based answers with enough technical context for a useful engineering discussion.",
    template: ["Context", "Open question", "Useful response criteria", "Respectful invitation"],
  },
  {
    id: "threads-learning-series",
    label: "Threads & Learning Series",
    mode: "thread",
    guidance: "Give each post one job, number the sequence, preserve narrative continuity, and close with a recap or next lesson.",
    template: ["Series hook", "Ordered lessons", "Transitions", "Recap", "Next lesson"],
  },
] as const;

export type ContentFormat = (typeof CONTENT_FORMATS)[number];
export type ContentFormatId = ContentFormat["id"];
export type ContentFormatMode = ContentFormat["mode"];

export const CONTENT_FORMAT_IDS = CONTENT_FORMATS.map((format) => format.id) as readonly ContentFormatId[];

export function getContentFormat(id: ContentFormatId): ContentFormat {
  const format = CONTENT_FORMATS.find((item) => item.id === id);
  if (!format) throw new Error(`Unknown content format: ${id}`);
  return format;
}
