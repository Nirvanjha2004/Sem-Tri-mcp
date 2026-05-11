import { SearchResult } from "./signals/keyword.js";

export interface SemanticHit {
  file: string;
  line: number;
  score: number;
}

export interface TriangulatedMatch {
  file: string;
  line: number;
  totalScore: number;
}

export function triangulate(
  keywordHits: SearchResult[],
  semanticHits: SemanticHit[],
  structuralHits: any[]
): TriangulatedMatch[] {
  const scores = new Map<string, number>();

  // Keyword signal: +1 per hit
  keywordHits.forEach(h => {
    const key = `${h.file}:${h.line}`;
    scores.set(key, (scores.get(key) || 0) + 1);
  });

  // Structural signal: +2 per hit (high signal — identifier matched in AST)
  structuralHits.forEach(h => {
    const key = `${h.file}:${h.line}`;
    scores.set(key, (scores.get(key) || 0) + 2);
  });

  // Semantic signal: weighted by cosine similarity score (0–1.5 range)
  // A perfect semantic match (score=1.0) contributes 1.5 points,
  // sitting between keyword (+1) and structural (+2).
  semanticHits.forEach(h => {
    const key = `${h.file}:${h.line}`;
    const weight = Math.min(h.score * 1.5, 1.5);
    scores.set(key, (scores.get(key) || 0) + weight);
  });

  // Sort by total score descending, return top 10
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, totalScore]) => {
      const lastColon = key.lastIndexOf(":");
      const file = key.slice(0, lastColon);
      const line = parseInt(key.slice(lastColon + 1));
      return { file, line, totalScore };
    });
}
