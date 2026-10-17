export const CONTENT_FORMATS = [
  {
    id: "historical-first-principles",
    label: "Historical Evolution & First Principles",
    mode: "thread",
    guidance: "Tell an accurate chronology driven by real constraints: the original human problem, the earliest workable mechanism, what operators actually did, the limit that mattered, and why later designs appeared. Avoid tidy but false invention chains.",
    template: ["Original problem", "Earliest practical solution", "How it worked", "Limitations", "What changed next", "Modern mechanism"],
  },
  {
    id: "real-world-analogies",
    label: "Real-World Analogies",
    mode: "single",
    guidance: "Open inside a familiar physical situation, map only the parts that genuinely correspond, then reveal the real packets, processes, permissions, or control plane. State exactly where the analogy breaks.",
    template: ["Familiar scene", "Concept mapping", "Mechanism", "Where the analogy stops", "Technical takeaway"],
  },
  {
    id: "things-you-probably-didnt-know",
    label: "Things You Probably Didn't Know",
    mode: "single",
    guidance: "Lead with one counterintuitive but verifiable behavior, prove it with a mechanism or source, then show the operational consequence. Surprise must come from truth, not dramatic wording.",
    template: ["Surprising fact", "Evidence", "Mechanism", "Practical meaning"],
  },
  {
    id: "breaking-technology-updates",
    label: "Breaking Technology Updates",
    mode: "single",
    guidance: "Lead with the precise change and who announced it. Separate the publisher's confirmed facts, your operational interpretation, who may be affected, and what remains unknown.",
    template: ["Confirmed change", "Who announced it", "Impact", "What remains unknown", "Original source"],
  },
  {
    id: "beginner-friendly-education",
    label: "Beginner-Friendly Education",
    mode: "single",
    guidance: "Start from a real task or symptom a new cloud engineer can recognize. Explain one mechanism in plain language, use a compact infrastructure example, correct one likely misconception, and leave an accurate mental model.",
    template: ["Plain-language definition", "Small example", "Common confusion", "Takeaway"],
  },
  {
    id: "deep-technical-education",
    label: "Deep Technical Education",
    mode: "thread",
    guidance: "Choose a narrow system boundary and follow the real control or data path through it. Surface implementation constraints, tradeoffs, failure modes, observability signals, and the decision an experienced operator must make.",
    template: ["System boundary", "Internal mechanism", "Tradeoffs", "Failure modes", "Operational guidance"],
  },
  {
    id: "practical-tutorials",
    label: "Practical Tutorials",
    mode: "thread",
    guidance: "Promise one useful outcome, name prerequisites and risk, then give reproducible steps with expected evidence at each checkpoint. Include cleanup or rollback rather than ending at a command.",
    template: ["Goal", "Prerequisites", "Steps", "Verification", "Cleanup or rollback"],
  },
  {
    id: "troubleshooting-challenges",
    label: "Troubleshooting Challenges",
    mode: "single",
    guidance: "Present a realistic symptom set, a small amount of diagnostic evidence, and one decision point. Remove irrelevant noise, keep the diagnosis private in moderator notes, and reward reasoning instead of lucky guessing.",
    template: ["Scenario", "Symptoms", "Evidence", "Question", "Moderator answer"],
  },
  {
    id: "architecture-discussions",
    label: "Architecture Discussions",
    mode: "single",
    guidance: "Begin with workload requirements and constraints, sketch the decision boundary, and compare designs through failure recovery, cost, security, and operations. Invite tradeoff discussion without declaring a universal winner.",
    template: ["Requirements", "Constraints", "Design", "Tradeoffs", "Discussion prompt"],
  },
  {
    id: "ask-grok",
    label: "Ask Grok",
    mode: "single",
    guidance: "Use @grok only when a real interaction improves the premise. It may be playful roleplay, satire, a social exchange, a clever challenge, visual interpretation, or technical examination. Ground image-based questions in inspected pixels, keep any correct answer private, and never imply Grok already replied.",
    template: ["Creative premise", "Optional evidence or visual", "Question or role for @grok", "Private context", "Truthful interaction state"],
  },
  {
    id: "myths-vs-facts",
    label: "Myths vs Facts",
    mode: "single",
    guidance: "State the strongest fair version of the misconception, replace it with a precise fact, and explain the boundary condition that makes the myth sound plausible. Avoid scolding beginners.",
    template: ["Myth", "Fact", "Why the myth persists", "Boundary or exception"],
  },
  {
    id: "tech-humor-memes",
    label: "Tech Humor & Memes",
    mode: "single",
    guidance: "Build the joke from a recognizable engineering tension such as DNS, YAML, alerts, permissions, or environment drift. Keep the mechanism accurate, make the punchline concise, and never target a person or pass unsafe behavior off as guidance.",
    template: ["Relatable setup", "Technical tension", "Punchline", "Optional accurate footnote"],
  },
  {
    id: "polls-interactive-questions",
    label: "Polls & Interactive Questions",
    mode: "poll",
    guidance: "Ask one concrete decision question with mutually distinct choices that working engineers might reasonably choose. Give just enough context to make votes meaningful and never frame an informal poll as representative research.",
    template: ["Question", "Two to four options", "Context", "Planned result discussion"],
  },
  {
    id: "engineering-observations",
    label: "Engineering Observations",
    mode: "single",
    guidance: "Notice a specific operational pattern, explain the conditions under which it appears, explore a plausible mechanism, and name the limits. Invite peers to compare evidence instead of announcing a universal law.",
    template: ["Observation", "Context", "Why it may happen", "Limits", "Question to peers"],
  },
  {
    id: "careers-opportunities",
    label: "Careers & Opportunities",
    mode: "single",
    guidance: "Lead with a verified role or practical career lesson, preserve employer, seniority, and geographic restrictions exactly, explain who the opportunity suits, and point only to the official application path.",
    template: ["Role or lesson", "Who it suits", "Verified location", "Requirements", "Official source"],
  },
  {
    id: "projects-hands-on-challenges",
    label: "Projects & Hands-On Challenges",
    mode: "thread",
    guidance: "Set an achievable infrastructure build with explicit constraints, acceptance checks, and a visible artifact. Offer layered hints and meaningful extensions while disclosing required accounts, costs, and cleanup.",
    template: ["Build goal", "Constraints", "Acceptance checks", "Hints", "Extensions"],
  },
  {
    id: "technical-comparisons",
    label: "Technical Comparisons",
    mode: "single",
    guidance: "Choose one real workload and judge every option against the same criteria. Show where each design wins, where it fails, and which constraint should decide the choice. Avoid feature-list scorecards.",
    template: ["Decision context", "Shared criteria", "Option A", "Option B", "When each fits"],
  },
  {
    id: "visual-education",
    label: "Visual Education",
    mode: "single",
    guidance: "Design the explanation around one mechanism the audience can see. Keep every label, arrow, boundary, legend, and caption consistent, and use the text to explain what changes as information moves through the visual.",
    template: ["Learning objective", "Diagram elements", "Connections", "Legend", "Caption"],
  },
  {
    id: "community-engagement",
    label: "Community Engagement",
    mode: "single",
    guidance: "Give a concrete engineering situation and invite evidence-based experience, design alternatives, or diagnostic approaches. Set a respectful scope so replies become useful peer knowledge rather than empty opinions.",
    template: ["Context", "Open question", "Useful response criteria", "Respectful invitation"],
  },
  {
    id: "threads-learning-series",
    label: "Threads & Learning Series",
    mode: "thread",
    guidance: "Build a sequence with a clear promise and narrative movement. Give each post one job, connect it to the next, vary explanation with examples or evidence, and close with a useful recap or a clearly earned next lesson.",
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
