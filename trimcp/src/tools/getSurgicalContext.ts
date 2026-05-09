import { keywordSearch } from "../signals/keyword.js";
import { getStructuralMatches } from "../signals/structure.js";
import { triangulate } from "../triangulate.js";
import fs from "fs";

export const getSurgicalContextTool = {
  definition: {
    name: "get_surgical_context",
    description: "Returns surgical code context using keyword + semantic + structure triangulation.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        projectPath: { type: "string" }
      },
      required: ["query", "projectPath"]
    }
  },
  handler: async (args: any) => {
    const { query, projectPath } = args;
    
    // 1. Run Signals
    // Strip stop words and short tokens — same logic as keywordSearch
    const STOP_WORDS = new Set(["find", "show", "get", "the", "for", "and", "with", "from", "that", "this", "logic"]);
    const keywords = query
      .split(/\s+/)
      .map((k: string) => k.toLowerCase())
      .filter((k: string) => k.length > 3 && !STOP_WORDS.has(k));

    const kwHits = keywordSearch(query, projectPath);
    const stHits = getStructuralMatches(projectPath, keywords);

    // 2. AND-filter: only keep files where ALL keywords appear at least once.
    // This prevents a single common word like "connection" from surfacing
    // unrelated files when the other keywords (e.g. "prisma") have zero hits.
    let filteredKwHits = kwHits;
    if (keywords.length > 1) {
      const filesByKeyword = new Map<string, Set<string>>();
      for (const hit of kwHits) {
        for (const kw of keywords) {
          if (hit.content.toLowerCase().includes(kw)) {
            if (!filesByKeyword.has(kw)) filesByKeyword.set(kw, new Set());
            filesByKeyword.get(kw)!.add(hit.file);
          }
        }
      }
      // Files that appear in every keyword's set
      const fileSets = Array.from(filesByKeyword.values());
      const qualifiedFiles = fileSets.length === keywords.length
        ? fileSets.reduce((a, b) => new Set([...a].filter(f => b.has(f))))
        : new Set<string>();

      filteredKwHits = kwHits.filter(h => qualifiedFiles.has(h.file));
    }

    // 3. Triangulate
    const intersections = triangulate(filteredKwHits, [], stHits);
    
    // 4. Extract exact lines
    if (intersections.length === 0) {
      return {
        content: [{ type: "text", text: "No results found for the given query in this project." }]
      };
    }

    const results = intersections.map(match => {
      const content = fs.readFileSync(match.file, "utf8").split("\n");
      const start = Math.max(0, match.line - 5);
      const end = Math.min(content.length, match.line + 10);
      return {
        file: match.file,
        snippet: content.slice(start, end).join("\n")
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
    };
  }
};