import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getSurgicalContextTool } from "./tools/getSurgicalContext.js";

const server = new Server(
  { name: "trimcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// Register Tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [getSurgicalContextTool.definition],
}));

// Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_surgical_context") {
    return await getSurgicalContextTool.handler(request.params.arguments);
  }
  throw new Error("Tool not found");
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("TrimCP Surgical Context Server running on stdio");