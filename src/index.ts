#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ToolDef, asContent } from "./tools/tool.js";
import { autocompleteTool, searchTool } from "./tools/search.js";
import { searchFiltersTool, categoryBrowseTool } from "./tools/category.js";
import { productPricesTool, productDetailTool } from "./tools/prices.js";
import { priceHistoryTool } from "./tools/history.js";
import { dealsTool, homeFeedTool, quickviewSingleTool } from "./tools/home.js";
import {
  loginTool,
  logoutTool,
  accountInfoTool,
  favoritesTool,
  favoriteAddTool,
  favoriteRemoveTool,
  priceAlertsTool,
  priceAlertSetTool,
  notificationsTool,
} from "./tools/account.js";
import { llmEnrichTool } from "./tools/enrich.js";
import { AkakceApiError, AkakceAuthError } from "./client.js";

const TOOLS: ToolDef[] = [
  // --- discovery / browse (public) ---
  autocompleteTool,
  searchTool,
  searchFiltersTool,
  categoryBrowseTool,
  homeFeedTool,
  dealsTool,
  // --- product / pricing (public) ---
  productPricesTool,
  quickviewSingleTool,
  productDetailTool,
  priceHistoryTool,
  // --- account (auth) ---
  loginTool,
  logoutTool,
  accountInfoTool,
  favoritesTool,
  favoriteAddTool,
  favoriteRemoveTool,
  priceAlertsTool,
  priceAlertSetTool,
  notificationsTool,
  // --- llm ---
  llmEnrichTool,
];

const server = new McpServer({ name: "akakce-mcp", version: "0.2.0" });

for (const tool of TOOLS) {
  server.registerTool(tool.name, tool.config, async (args: unknown) => {
    try {
      const result = await tool.handler(args ?? {});
      return asContent(result);
    } catch (err) {
      const msg =
        err instanceof AkakceAuthError
          ? err.message
          : err instanceof AkakceApiError
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
  console.error(`akakce-mcp ready (stdio). ${TOOLS.length} tools.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
