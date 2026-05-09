import fs from "fs";
import { getEmbedding, cosineSimilarity } from "../signals/semantic.js";
import { EmbeddingCache } from "../cache/embeddingCache.js";

export class VectorIndex {
  private cache: EmbeddingCache;

  constructor(projectPath: string) {
    this.cache = new EmbeddingCache(projectPath);
  }

  async indexFile(filePath: string) {
    const stats = fs.statSync(filePath);
    const cached = this.cache.get(filePath);

    if (cached && cached.mtime === stats.mtimeMs) return;

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const chunks: string[] = [];
    
    // Chunking: 50 lines per chunk with 10 lines overlap
    for (let i = 0; i < lines.length; i += 40) {
      chunks.push(lines.slice(i, i + 50).join("\n"));
    }

    const embeddedChunks = await Promise.all(
      chunks.map(async (text) => ({
        text,
        embedding: await getEmbedding(text),
      }))
    );

    this.cache.set(filePath, {
      mtime: stats.mtimeMs,
      chunks: embeddedChunks,
    });
  }

  async search(query: string, projectPath: string) {
    const queryVector = await getEmbedding(query);
    const results: any[] = [];

    // Simple exhaustive search for MVP
    // (For large repos, you'd want a vector DB like HNSW)
    const files = fs.readdirSync(projectPath, { recursive: true }) as string[];
    
    for (const file of files) {
      const cached = this.cache.get(file);
      if (!cached) continue;

      cached.chunks.forEach((chunk) => {
        const score = cosineSimilarity(queryVector, chunk.embedding);
        if (score > 0.7) { // Threshold
          results.push({ file, text: chunk.text, score });
        }
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 10);
  }
}