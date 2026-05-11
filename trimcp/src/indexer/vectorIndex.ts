import fs from "fs";
import path from "path";
import { getEmbedding, cosineSimilarity } from "../signals/semantic.js";
import { EmbeddingCache } from "../cache/embeddingCache.js";
import { chunkByAst } from "./astChunker.js";

// Source file extensions to index
const INDEXABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".cs", ".cpp", ".c", ".rb"]);

// Directories to skip
const SKIP_DIRS = new Set(["node_modules", "build", "dist", ".git", ".trimcp", "coverage", "__pycache__", ".venv", "vendor"]);

export class VectorIndex {
  private cache: EmbeddingCache;
  private indexed = false;

  constructor(projectPath: string) {
    this.cache = new EmbeddingCache(projectPath);
  }

  /**
   * Recursively collect all indexable source files under a directory,
   * skipping noise directories.
   */
  private collectFiles(dir: string): string[] {
    const results: string[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return results;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.collectFiles(full));
      } else if (entry.isFile() && INDEXABLE_EXTENSIONS.has(path.extname(entry.name))) {
        results.push(full);
      }
    }
    return results;
  }

  /**
   * Index a single file. Skips if the cached mtime matches — no re-embedding needed.
   */
  async indexFile(filePath: string): Promise<void> {
    let stats: fs.Stats;
    try {
      stats = fs.statSync(filePath);
    } catch {
      return; // file may have been deleted
    }

    const cached = this.cache.get(filePath);
    if (cached && cached.mtime === stats.mtimeMs) return; // up to date

    const content = fs.readFileSync(filePath, "utf8");

    // Use AST-aware chunking for TS/TSX, line-based fallback for everything else
    const astChunks = chunkByAst(filePath, content);
    if (astChunks.length === 0) return;

    const embeddedChunks = await Promise.all(
      astChunks.map(async (chunk) => ({
        text: chunk.text,
        startLine: chunk.startLine,
        embedding: await getEmbedding(chunk.text),
      }))
    );

    this.cache.set(filePath, {
      mtime: stats.mtimeMs,
      chunks: embeddedChunks,
    });
  }

  /**
   * Index all source files in the project. Safe to call multiple times —
   * only files with changed mtimes are re-embedded.
   */
  async indexProject(projectPath: string): Promise<void> {
    if (this.indexed) return; // already done this session
    const files = this.collectFiles(projectPath);
    console.error(`[TrimCP] Indexing ${files.length} files in ${projectPath}...`);
    // Index concurrently in batches of 5 to avoid overwhelming the embedder
    const BATCH = 5;
    for (let i = 0; i < files.length; i += BATCH) {
      await Promise.all(files.slice(i, i + BATCH).map(f => this.indexFile(f)));
    }
    this.indexed = true;
    console.error(`[TrimCP] Indexing complete.`);
  }

  async search(query: string, projectPath: string): Promise<Array<{ file: string; line: number; score: number }>> {
    const queryVector = await getEmbedding(query);
    const results: Array<{ file: string; line: number; score: number }> = [];

    const files = this.collectFiles(projectPath);

    for (const file of files) {
      const cached = this.cache.get(file);
      if (!cached) continue;

      cached.chunks.forEach((chunk) => {
        const score = cosineSimilarity(queryVector, chunk.embedding);
        if (score > 0.5) { // lowered threshold — reranker (Step 3) will filter further
          results.push({ file, line: chunk.startLine, score });
        }
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  }
}

// Global registry: one VectorIndex per projectPath, shared across queries
const indexRegistry = new Map<string, VectorIndex>();

export function getVectorIndex(projectPath: string): VectorIndex {
  if (!indexRegistry.has(projectPath)) {
    indexRegistry.set(projectPath, new VectorIndex(projectPath));
  }
  return indexRegistry.get(projectPath)!;
}
