import type { AiResearchEvidence } from "./types.ts";

export function selectVariedEvidence(
  evidence: readonly AiResearchEvidence[],
  limit = 16,
): readonly AiResearchEvidence[] {
  const safeLimit = Math.min(20, Math.max(1, Math.floor(limit)));
  const selected: AiResearchEvidence[] = [];
  const usedCombinations = new Set<string>();
  for (const item of evidence) {
    const key = `${item.primaryTopic ?? "uncategorized"}:${item.publisher}`;
    if (usedCombinations.has(key)) continue;
    usedCombinations.add(key);
    selected.push(item);
    if (selected.length === safeLimit) return selected;
  }
  for (const item of evidence) {
    if (selected.some((selectedItem) => selectedItem.id === item.id)) continue;
    selected.push(item);
    if (selected.length === safeLimit) break;
  }
  return selected;
}
