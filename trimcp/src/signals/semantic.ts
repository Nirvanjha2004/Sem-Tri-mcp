import { pipeline } from "@xenova/transformers";

let embedder: any = null;

export async function getEmbedding(text: string) {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export function cosineSimilarity(vecA: number[], vecB: number[]) {
  return vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
}