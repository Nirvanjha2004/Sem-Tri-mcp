import { keywordSearch } from "../signals/keyword.js";
import { getStructuralMatches } from "../signals/structure.js";
import { triangulate } from "../triangulate.js";
import { getVectorIndex } from "../indexer/vectorIndex.js";
import { rerank } from "../signals/reranker.js";
import { expandQuery } from "../signals/queryExpander.js";
import fs from "fs";

const STOP_WORDS = new Set([
  "find", "show", "get", "the", "for", "and", "with", "from",
  "that", "this", "logic", "code", "where", "what", "how", "does"
]);

function extractKeywords(query: string): string[] {
  return query
    .split(/\s+/)
    .map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(k => k.length > 3 && !STOP_WORDS.has(k));
}

export const getSurgicalContextTool = {
  definition: {
    name: "get_surgical_context",
    description:
      "Returns surgical code context using keyword + semantic + structure triangulation. " +
      "Provide a natural language query and the absolute path to the project.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language description of what you are looking for"
        },
        projectPath: {
          type: "string",
          description: "Absolute path to the project root to search"
        }
      },
      required: ["query", "projectPath"]
    }
  },

  handler: async (args: any) => {
    const { query, projectPath } = args;

    // --- Input validation ---
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return { content: [{ type: "text", text: "Error: query must be a non-empty string." }] };
    }
    if (!projectPath || typeof projectPath !== "string") {
      return { content: [{ type: "text", text: "Error: projectPath must be a non-empty string." }] };
    }
    if (!fs.existsSync(projectPath)) {
      return { content: [{ type: "text", text: `Error: projectPath does not exist: ${projectPath}` }] };
    }

    const keywords = extractKeywords(query);

    // --- Signal 1: Keyword (ripgrep) ---
    const kwHits = keywordSearch(query, projectPath);

    // AND-filter: only keep files where ALL keywords appear at least once
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
      const fileSets = Array.from(filesByKeyword.values());
      const qualifiedFiles =
        fileSets.length === keywords.length
          ? fileSets.reduce((a, b) => new Set([...a].filter(f => b.has(f))))
          : new Set<string>();
      filteredKwHits = kwHits.filter(h => qualifiedFiles.has(h.file));
    }

    // --- Signal 2: Structural (ts-morph AST) ---
    const stHits = getStructuralMatches(projectPath, keywords);

    // --- Signal 3: Semantic (vector embeddings) ---
    let semHits: Array<{ file: string; line: number; score: number }> = [];
    try {
      const vectorIndex = getVectorIndex(projectPath);
      await vectorIndex.indexProject(projectPath);
      // Expand query with synonyms before embedding for broader semantic coverage
      const expandedQuery = expandQuery(query);
      semHits = await vectorIndex.search(expandedQuery, projectPath);
    } catch (e) {
      // Semantic signal is best-effort — don't fail the whole query
      console.error("[TrimCP] Semantic search error:", e);
    }

    // --- Triangulate all three signals ---
    const intersections = triangulate(filteredKwHits, semHits, stHits);

    if (intersections.length === 0) {
      return {
        content: [{ type: "text", text: "No results found for the given query in this project." }]
      };
    }

    // --- Extract snippets ---
    const candidates = intersections.map(match => {
      try {
        const lines = fs.readFileSync(match.file, "utf8").split("\n");
        const start = Math.max(0, match.line - 5);
        const end = Math.min(lines.length, match.line + 10);
        return {
          file: match.file,
          line: match.line,
          snippet: lines.slice(start, end).join("\n"),
          originalScore: match.totalScore
        };
      } catch {
        return null;
      }
    }).filter((r): r is NonNullable<typeof r> => r !== null && r.snippet.length > 0);

    // --- Rerank for final ordering ---
    const reranked = await rerank(query, candidates);

    return {
      content: [{ type: "text", text: JSON.stringify(
        reranked.map(({ file, line, snippet, rerankedScore }) => ({ file, line, snippet, score: rerankedScore })),
        null, 2
      )}]
    };
  }
};
