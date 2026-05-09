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
    const keywords = query.split(" ");
    const kwHits = keywordSearch(query, projectPath);
    const stHits = getStructuralMatches(projectPath, keywords);
    
    // 2. Triangulate
    const intersections = triangulate(kwHits, [], stHits);
    
    // 3. Extract exact lines
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