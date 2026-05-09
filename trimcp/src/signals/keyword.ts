import { execSync } from "child_process";

export interface SearchResult {
  file: string;
  line: number;
  content: string;
}

export function keywordSearch(query: string, projectPath: string): SearchResult[] {
  try {
    // Extract keywords (simple split for MVP)
    const keywords = query.split(/\s+/).filter(k => k.length > 3);
    const pattern = keywords.join("|");
    
    // Run ripgrep: -n (line numbers), -i (ignore case), -H (file name)
    const output = execSync(`rg -iHn "${pattern}" "${projectPath}" --max-columns=200`, { encoding: "utf8" });
    
    return output.split("\n").filter(Boolean).map(line => {
      const [file, lineNo, ...content] = line.split(":");
      return {
        file,
        line: parseInt(lineNo),
        content: content.join(":").trim()
      };
    });
  } catch (e) {
    return []; // Return empty if rg finds nothing or fails
  }
}