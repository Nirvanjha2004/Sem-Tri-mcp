import fs from "fs";
import path from "path";

export interface CacheEntry {
  mtime: number;
  chunks: {
    text: string;
    startLine: number;
    embedding: number[];
  }[];
}

export class EmbeddingCache {
  private cachePath: string;
  private data: Record<string, CacheEntry> = {};

  constructor(projectPath: string) {
    this.cachePath = path.join(projectPath, ".trimcp", "cache.json");
    if (fs.existsSync(this.cachePath)) {
      this.data = JSON.parse(fs.readFileSync(this.cachePath, "utf8"));
    }
  }

  get(filePath: string): CacheEntry | null {
    return this.data[filePath] || null;
  }

  set(filePath: string, entry: CacheEntry) {
    this.data[filePath] = entry;
    this.save();
  }

  private save() {
    const dir = path.dirname(this.cachePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.cachePath, JSON.stringify(this.data));
  }
}