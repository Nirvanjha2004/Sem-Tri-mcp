import { Project, SyntaxKind, Node } from "ts-morph";

export interface AstChunk {
  text: string;
  startLine: number;
}

/**
 * Chunks a TypeScript file by function/class/method boundaries using ts-morph.
 * Each chunk is a semantically complete unit (a whole function or class body)
 * rather than an arbitrary line slice.
 *
 * Falls back to fixed-size line chunking for non-TS files or parse failures.
 */
export function chunkByAst(filePath: string, fileContent: string): AstChunk[] {
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
    return chunkByLines(fileContent);
  }

  try {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("temp.ts", fileContent);
    const chunks: AstChunk[] = [];
    const covered = new Set<number>(); // track covered line ranges to avoid duplicates

    const addChunk = (node: Node) => {
      const start = node.getStartLineNumber();
      const end = node.getEndLineNumber();
      // Skip if this range is already covered by a parent node
      if (covered.has(start)) return;
      for (let l = start; l <= end; l++) covered.add(l);
      chunks.push({
        text: node.getText(),
        startLine: start
      });
    };

    // Collect top-level and class-level declarations
    sourceFile.getFunctions().forEach(addChunk);
    sourceFile.getClasses().forEach(cls => {
      addChunk(cls);
      // Also add individual methods as separate chunks for finer granularity
      cls.getMethods().forEach(addChunk);
    });
    sourceFile.getInterfaces().forEach(addChunk);
    sourceFile.getTypeAliases().forEach(addChunk);
    sourceFile.getVariableStatements().forEach(stmt => {
      // Arrow functions assigned to variables
      stmt.getDeclarations().forEach(decl => {
        const init = decl.getInitializer();
        if (
          init &&
          (init.getKind() === SyntaxKind.ArrowFunction ||
            init.getKind() === SyntaxKind.FunctionExpression)
        ) {
          addChunk(stmt);
        }
      });
    });

    // If AST extraction found nothing meaningful, fall back to line chunking
    if (chunks.length === 0) return chunkByLines(fileContent);

    return chunks;
  } catch {
    return chunkByLines(fileContent);
  }
}

/**
 * Fallback: fixed-size line chunking with overlap.
 * Used for non-TS files (Python, Go, etc.) and AST parse failures.
 */
function chunkByLines(content: string): AstChunk[] {
  const lines = content.split("\n");
  const chunks: AstChunk[] = [];
  const CHUNK_SIZE = 50;
  const STEP = 40; // 10-line overlap

  for (let i = 0; i < lines.length; i += STEP) {
    const text = lines.slice(i, i + CHUNK_SIZE).join("\n").trim();
    if (text.length > 0) {
      chunks.push({ text, startLine: i + 1 });
    }
  }
  return chunks;
}
