import chokidar from "chokidar";
import { VectorIndex } from "./vectorIndex.js";

export function setupWatcher(projectPath: string, index: VectorIndex) {
  const watcher = chokidar.watch(projectPath, {
    ignored: [/(^|[\/\\])\../, "node_modules", "dist", "build"],
    persistent: true,
  });

  watcher.on("change", async (path) => {
    if (path.endsWith(".ts") || path.endsWith(".js") || path.endsWith(".py")) {
      console.error(`File changed: ${path}. Re-indexing...`);
      await index.indexFile(path);
    }
  });

  return watcher;
}