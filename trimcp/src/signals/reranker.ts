import { pipeline } from "@xenova/transformers";

let reranker: any = null;

/**
 * Cross-encoder reranker using ms-marco-MiniLM-L-6-v2.
 * Unlike embedding cosine similarity (which compares vectors independently),
 * a cross-encoder sees the query and document together and scores their
 * relevance directly — much more accurate for code search.
 */
async function getReranker() {
  if (!reranker) {
    reranker = await pipeline("text-classification", "Xenova/ms-marco-MiniLM-L-6-v2");
  }
  return reranker;
}

export interface RerankCandidate {
  file: string;
  line: number;
  snippet: string;
  originalScore: number;
}

export interface RerankResult extends RerankCandidate {
  rerankedScore: number;
}

/**
 * Reranks a list of candidates against the query using a cross-encoder.
 * Returns candidates sorted by reranked score, highest first.
 */
export async function rerank(
  query: string,
  candidates: RerankCandidate[]
): Promise<RerankResult[]> {
  if (candidates.length === 0) return [];

  try {
    const model = await getReranker();

    const scored = await Promise.all(
      candidates.map(async (candidate) => {
        // Cross-encoder takes [query, document] as a pair
        const result = await model(query, { text_pair: candidate.snippet });
        // The model outputs a relevance score — higher is more relevant
        const rerankedScore: number =
          Array.isArray(result) && result[0]?.score != null
            ? result[0].score
            : candidate.originalScore;

        return { ...candidate, rerankedScore };
      })
    );

    return scored.sort((a, b) => b.rerankedScore - a.rerankedScore);
  } catch (e) {
    // Reranker is best-effort — fall back to original scores
    console.error("[TrimCP] Reranker error:", e);
    return candidates.map(c => ({ ...c, rerankedScore: c.originalScore }));
  }
}
