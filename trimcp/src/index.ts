import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getSurgicalContextTool } from "./tools/getSurgicalContext.js";
import { execSync } from "child_process";

// --- Startup checks ---

// Verify ripgrep is available — keyword signal depends on it
try {
  execSync("rg --version", { stdio: "ignore" });
} catch {
  console.error(
    "[TrimCP] ERROR: ripgrep (rg) not found on PATH.\n" +
    "  Install it from: https://github.com/BurntSushi/ripgrep#installation\n" +
    "  macOS:   brew install ripgrep\n" +
    "  Windows: winget install BurntSushi.ripgrep.MSVC\n" +
    "  Ubuntu:  sudo apt install ripgrep\n" +
    "Keyword search will return no results until ripgrep is installed."
  );
}

// Warn about first-run model downloads
console.error(
  "[TrimCP] Note: On first use, embedding models will be downloaded automatically.\n" +
  "  Primary:  jinaai/jina-embeddings-v2-base-code (~500MB)\n" +
  "  Reranker: Xenova/ms-marco-MiniLM-L-6-v2 (~85MB)\n" +
  "  Models are cached locally after the first download."
);

// --- MCP Server ---

const server = new Server(
  { name: "trimcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [getSurgicalContextTool.definition],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_surgical_context") {
    return await getSurgicalContextTool.handler(request.params.arguments);
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[TrimCP] Surgical Context Server running on stdio — ready.");
