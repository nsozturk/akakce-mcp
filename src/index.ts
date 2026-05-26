#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ToolDef, asContent } from "./tools/tool.js";
import { autocompleteTool, searchTool } from "./tools/search.js";
import { searchFiltersTool, categoryBrowseTool } from "./tools/category.js";
import { productPricesTool, productDetailTool } from "./tools/prices.js";
import { priceHistoryTool } from "./tools/history.js";
import { llmEnrichTool } from "./tools/enrich.js";
import { AkakceApiError } from "./client.js";

const TOOLS: ToolDef[] = [
  autocompleteTool,
  searchTool,
  searchFiltersTool,
  categoryBrowseTool,
  productPricesTool,
  productDetailTool,
  priceHistoryTool,
  llmEnrichTool,
];

const server = new McpServer({
  name: "akakce-mcp",
  version: "0.1.0",
});

for (const tool of TOOLS) {
  server.registerTool(tool.name, tool.config, async (args: unknown) => {
    try {
      const result = await tool.handler(args ?? {});
      return asContent(result);
    } catch (err) {
      const msg =
        err instanceof AkakceApiError
          ? `Akakçe API hatası: ${err.message}${err.url ? ` (${err.url})` : ""}`
          : err instanceof Error
            ? err.message
            : String(err);
      return { content: [{ type: "text" as const, text: msg }], isError: true };
    }
  });
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP transport channel.
  console.error("akakce-mcp ready (stdio). Tools:", TOOLS.map((t) => t.name).join(", "));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
