export function Icon({ kind = "grid" }: { kind?: "grid" | "research" | "create" | "engage" | "hub" | "arrow" }) {
  const paths = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    research: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14 M15 15l6 6",
    create: "M14 4l6 6 M3 21l5-1L21 7a2 2 0 0 0-4-4L4 16z",
    engage: "M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 18-4 M7 10h8 M7 14h5",
    hub: "M4 4h16v16H4z M4 9h16 M9 9v11",
    arrow: "M5 12h14 M13 6l6 6-6 6",
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="icon"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
