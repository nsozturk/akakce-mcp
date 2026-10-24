#!/usr/bin/env node
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
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
import { AkakceApiError, AkakceAuthError, loginRequest, apiGet } from "./client.js";
import {
  saveSession,
  setSessionCookie,
  clearSession,
  SESSION_FILE,
  authCookie,
} from "./session.js";

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

async function handleCli(command: string, args: string[]) {
  if (command === "help" || command === "--help" || command === "-h") {
    console.log(`
akakce-mcp — Model Context Protocol Server for Akakçe (akakce.com)

Usage:
  akakce-mcp                     Start the stdio MCP server (default)
  akakce-mcp auth                Interactive terminal login
  akakce-mcp login <email> <pwd> Non-interactive login with credentials
  akakce-mcp set-cookie <cookie> Store browser AAATLGST cookie directly
  akakce-mcp status | whoami     Check current authentication status
  akakce-mcp logout              Clear saved session credentials

Environment Variables:
  AKAKCE_COOKIE                  Set AAATLGST cookie directly (ideal for Docker / headless)
  AKAKCE_EMAIL / AKAKCE_PASSWORD Login credentials for automated in-tool auth
  FIREWORKS_API_KEY              Optional: enable LLM result enrichment via Kimi Turbo
`);
    process.exit(0);
  }

  if (command === "auth" || command === "login") {
    let email = args[0] || process.env.AKAKCE_EMAIL;
    let password = args[1] || process.env.AKAKCE_PASSWORD;

    if (!email || !password) {
      const rl = readline.createInterface({ input, output });
      try {
        if (!email) {
          email = await rl.question("Akakçe Email: ");
        }
        if (!password) {
          password = await rl.question("Akakçe Password: ");
        }
      } finally {
        rl.close();
      }
    }

    if (!email || !password) {
      console.error("Error: Email and password are required.");
      process.exit(1);
    }

    console.log(`Logging in to api6.akakce.com as ${email.trim()}...`);
    try {
      const { cookie, result } = await loginRequest(email.trim(), password.trim());
      saveSession({
        cookie,
        userId: result?.id,
        email: result?.email || email.trim(),
        name: result?.name,
        savedAt: new Date().toISOString(),
      });
      console.log(`✓ Login successful!`);
      console.log(`✓ Session saved to ${SESSION_FILE}`);
      if (result?.name) console.log(`Welcome, ${result.name}!`);
      process.exit(0);
    } catch (err: any) {
      console.error(`✗ Login failed: ${err.message}`);
      process.exit(1);
    }
  }

  if (command === "set-cookie") {
    const cookie = args[0] || process.env.AKAKCE_COOKIE;
    if (!cookie) {
      console.error("Usage: akakce-mcp set-cookie <AAATLGST=...>");
      process.exit(1);
    }
    setSessionCookie(cookie);
    console.log(`✓ Cookie saved to ${SESSION_FILE}`);
    process.exit(0);
  }

  if (command === "status" || command === "whoami") {
    const cookie = authCookie();
    if (!cookie) {
      console.log("No active Akakçe session found.");
      console.log(`Run 'akakce-mcp auth' or set AKAKCE_COOKIE env var to authenticate.`);
      process.exit(0);
    }
    try {
      const d = await apiGet<any>("/user/info", {}, { app: true, auth: true });
      const r = d?.result ?? {};
      console.log("✓ Authenticated with Akakçe:");
      console.log(`  Name:    ${r.name || "—"} ${r.surname || ""}`);
      console.log(`  Email:   ${r.email || "—"}`);
      console.log(`  User ID: ${r.id || "—"}`);
      console.log(`  Storage: ${SESSION_FILE}`);
      process.exit(0);
    } catch (err: any) {
      console.error(`✗ Saved session is invalid or expired: ${err.message}`);
      process.exit(1);
    }
  }

  if (command === "logout") {
    clearSession();
    console.log("✓ Logged out. Session cleared.");
    process.exit(0);
  }

  console.error(`Unknown command: ${command}. Run 'akakce-mcp --help' for available commands.`);
  process.exit(1);
}

async function main() {
  const arg = process.argv[2];
  if (arg) {
    await handleCli(arg, process.argv.slice(3));
    return;
  }

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

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`akakce-mcp ready (stdio). ${TOOLS.length} tools.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
