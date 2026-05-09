import { execSync } from "child_process";

export interface SearchResult {
  file: string;
  line: number;
  content: string;
}

export function keywordSearch(query: string, projectPath: string): SearchResult[] {
  try {
    // Strip common stop words and short tokens
    const STOP_WORDS = new Set(["find", "show", "get", "the", "for", "and", "with", "from", "that", "this", "logic"]);
    const keywords = query
      .split(/\s+/)
      .map(k => k.toLowerCase())
      .filter(k => k.length > 3 && !STOP_WORDS.has(k));
    if (keywords.length === 0) return [];

    // Wrap each keyword in word boundaries so "connection" doesn't match inside "function"
    const pattern = keywords.map(k => `\\b${k}\\b`).join("|");

    // Use --json so ripgrep emits structured output — no path parsing needed.
    // This is immune to Windows drive-letter colons and spaces in paths.
    // Only search source code files, not docs or type declarations.
    const output = execSync(
      `rg --json -i -n --glob "!node_modules" --glob "!build" --glob "!dist" --glob "!*.d.ts" --glob "!*.md" --glob "!*.json" --glob "!*.txt" --glob "!*.lock" -e "${pattern}" -- "${projectPath}"`,
      { encoding: "utf8" }
    );

    const results: SearchResult[] = [];

    for (const rawLine of output.split("\n")) {
      if (!rawLine.trim()) continue;

      let msg: any;
      try {
        msg = JSON.parse(rawLine);
      } catch {
        continue;
      }

      // ripgrep --json emits objects with a "type" field.
      // We only care about "match" events.
      if (msg.type !== "match") continue;

      const data = msg.data;
      // Skip lines that are pure comments — keyword hits in comments are noise
      const trimmed = data.lines.text.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("#")) {
        continue;
      }

      results.push({
        file: data.path.text,
        line: data.line_number,
        content: data.lines.text.trim(),
      });
    }

    return results;
  } catch (e) {
    return [];
  }
}
