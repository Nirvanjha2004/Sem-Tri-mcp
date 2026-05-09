import { SearchResult } from "./signals/keyword.js";

export function triangulate(
  keywordHits: SearchResult[],
  semanticHits: any[],
  structuralHits: any[]
) {
  const scores = new Map<string, number>();

  // Weighting logic: Intersection points get highest scores
  keywordHits.forEach(h => {
    const key = `${h.file}:${h.line}`;
    scores.set(key, (scores.get(key) || 0) + 1);
  });

  structuralHits.forEach(h => {
    const key = `${h.file}:${h.line}`;
    scores.set(key, (scores.get(key) || 0) + 2); // Structural hits are high signal
  });

  // Sort by score and take top 10
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key]) => {
      const lastColon = key.lastIndexOf(":");
      const file = key.slice(0, lastColon);
      const line = key.slice(lastColon + 1);
      return { file, line: parseInt(line) };
    });
}