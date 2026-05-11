import { pipeline } from "@xenova/transformers";

/**
 * Embedding model selection:
 *
 * Primary:  jinaai/jina-embeddings-v2-base-code
 *   - Trained specifically on code (GitHub, StackOverflow, docs)
 *   - Understands variable names, function signatures, code patterns
 *   - 8192 token context window — handles large functions without truncation
 *
 * Fallback: Xenova/all-MiniLM-L6-v2
 *   - General-purpose sentence model
 *   - Used if the Jina model fails to load
 */
const PRIMARY_MODEL = "jinaai/jina-embeddings-v2-base-code";
const FALLBACK_MODEL = "Xenova/all-MiniLM-L6-v2";

let embedder: any = null;
let activeModel = PRIMARY_MODEL;

async function loadEmbedder() {
  if (embedder) return embedder;

  try {
    embedder = await pipeline("feature-extraction", PRIMARY_MODEL);
    activeModel = PRIMARY_MODEL;
    console.error(`[TrimCP] Loaded embedding model: ${PRIMARY_MODEL}`);
  } catch (e) {
    console.error(`[TrimCP] Failed to load ${PRIMARY_MODEL}, falling back to ${FALLBACK_MODEL}:`, e);
    embedder = await pipeline("feature-extraction", FALLBACK_MODEL);
    activeModel = FALLBACK_MODEL;
    console.error(`[TrimCP] Loaded embedding model: ${FALLBACK_MODEL}`);
  }

  return embedder;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const model = await loadEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  return vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
}

export function getActiveModel(): string {
  return activeModel;
}
