export const sections = [
  {
    href: "/",
    title: "Dashboard",
    group: "Workspace",
    description: "Your starting point for research, content, and conversations.",
    empty: "Welcome to your workspace",
    detail: "Explore the four areas of the platform."
  },
  {
    href: "/tech-hub",
    title: "My Tech Intelligence",
    group: "Intelligence",
    description: "A personal view of the wider technology industry.",
    empty: "Your intelligence hub starts here",
    detail: "Personalized feeds, bookmarks, and digests are planned across cloud, software, Linux, networking, DevOps, security, AI, developer tools, open source, and communities. No private data is stored here; access control will precede private-data features."
  },
  {
    href: "/trending",
    title: "Trending",
    group: "Intelligence",
    description: "Discover developments worth researching.",
    empty: "No trends collected yet",
    detail: "Trusted-source ingestion and verified opportunities are coming in a future phase. No trend monitoring is running."
  },
  {
    href: "/stories",
    title: "Stories & News",
    group: "Intelligence",
    description: "Follow technical stories with evidence and context.",
    empty: "No stories collected yet",
    detail: "Future stories will include original links, timestamps, verification status, and duplicate detection. No news sources are connected."
  },
  {
    href: "/ideas",
    title: "Content Ideas",
    group: "Create",
    description: "Turn verified research into useful teaching opportunities.",
    empty: "Room for your next idea",
    detail: "Research-backed ideas and content opportunities are planned. There are no saved ideas or AI suggestions yet."
  },
  {
    href: "/studio",
    title: "Content Studio",
    group: "Create",
    description: "A future home for thoughtful cloud engineering content.",
    empty: "Your studio is waiting",
    detail: "Drafts, threads, tutorials, challenges, discussions, memes, and polls are planned. AI drafting is not connected; publishing will require human review and a manual action."
  },
  {
    href: "/learning-series",
    title: "Learning Series",
    group: "Create",
    description: "Teach mechanisms, context, and intuition in distinct series.",
    empty: "Build understanding, one lesson at a time",
    detail: "Style A: Historical-Evolutionary and First-Principles Teaching follows the original problem, early solutions, mechanisms, limitations, and evolution. Style B: Real-World Analogy Explainers uses relatable physical systems. These remain independent categories; neither replaces the other."
  },
  {
    href: "/posts",
    title: "Published Posts",
    group: "Engage",
    description: "A future record of your human-reviewed X publishing.",
    empty: "No published posts tracked yet",
    detail: "Published post tracking and content memory are planned. No X account is connected, and this workspace cannot publish posts."
  },
  {
    href: "/inbox",
    title: "Inbox",
    group: "Engage",
    description: "Bring engineering conversations into one workspace.",
    empty: "No conversations connected",
    detail: "A Shared Inbox, conversation hubs, and AI reply suggestions are planned. No messages are being collected or sent."
  },
  {
    href: "/analytics",
    title: "Analytics",
    group: "Engage",
    description: "Understand your content and engagement with real evidence.",
    empty: "No analytics available yet",
    detail: "Analytics will follow connected accounts and published post tracking. No account metrics or engagement measurements exist yet."
  },
  {
    href: "/sources",
    title: "Sources",
    group: "Manage",
    description: "Establish the trusted foundations of your research.",
    empty: "No sources connected yet",
    detail: "A curated source registry, original links, verification, and freshness indicators are planned. No ingestion or background processing is active."
  },
  {
    href: "/settings",
    title: "Settings",
    group: "Manage",
    description: "Shape your workspace as capabilities become available.",
    empty: "More controls are coming",
    detail: "Account connections, notifications, and personalized feeds are planned. Change this browser's appearance using the theme control in the header; no account settings are stored."
  },
] as const;
export type WorkspacePath = (typeof sections)[number]["href"];
export const navigationGroups = ["Workspace", "Intelligence", "Create", "Engage", "Manage"] as const;
export function getSection(path: WorkspacePath) {
  const section = sections.find((item) => item.href === path);
  if (!section) throw new Error(`Unknown workspace path: ${path}`);
  return section;
}
