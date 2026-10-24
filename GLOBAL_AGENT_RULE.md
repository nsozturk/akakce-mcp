# Global Agent Rule: Akakçe Price Comparison MCP (`akakce-mcp`)

> **Instructions for Developers:**
> Copy the section below into your global agent instructions file (e.g., `~/.claude/agents/akakce.md`, `~/.config/agent-rules/akakce.md`, `.cursorrules`, or your AI assistant's system instructions) to enable any AI agent to compare Turkish prices, search products, and track discounts automatically.

---

```markdown
## Turkish Price Comparison Tool (`akakce-mcp`)

When asked to check Turkish retail prices, find the cheapest seller for electronics, books, appliances, or hardware in Turkey, or set price drop alerts on Akakçe:

1. **MCP Server Integration:**
   - Command: `npx akakce-mcp` (or local `node <path>/dist/index.js`)
   - Claude Code: `claude mcp add akakce -- npx -y akakce-mcp`
   - Cursor: Add command `npx -y akakce-mcp` to Settings > Features > MCP

2. **Common Tool Workflows:**
   - **Search products:** `akakce_search({ phrase: "iphone 16" })`
   - **Quick price check:** `akakce_quickview({ code: 123456 })`
   - **Deep seller comparison:** `akakce_product_detail({ code: 123456 })` returns all verified sellers (Amazon, Hepsiburada, Trendyol, PttAVM, idefix, Teknosa), shipping costs, seller ratings, and direct redirect URLs.
   - **Autocomplete lookup:** If the exact model code is unknown, use `akakce_autocomplete({ query: "..." })` first.

3. **Authentication (Optional):**
   - Public search and price comparison work with zero credentials.
   - For user favorites, price alerts, and notifications, set `AKAKCE_COOKIE="AAATLGST=..."` or run `npx akakce-mcp auth`.
```
