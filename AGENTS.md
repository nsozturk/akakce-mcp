# AGENTS.md — Agent Specification for akakce-mcp

This document defines the operational contracts, execution commands, and failure recovery protocols for autonomous AI coding agents (Claude Code, Antigravity, Gemini CLI, Cursor, OpenCode, Codex) working within or using this repository.

---

## 1. Core Agent Capabilities

`akakce-mcp` is a Model Context Protocol (MCP) server providing structured programmatic access to [Akakçe](https://www.akakce.com) — Turkey's premier price comparison engine. It unlocks public product search, multi-seller live price comparison, category hierarchies, and authenticated user features (favorites, price drop alerts, notification stream).

### Execution Contracts

| Task | Command | Failure Fallback |
|---|---|---|
| **Run MCP Server (stdio)** | `npx akakce-mcp` (or `node dist/index.js`) | Rebuild via `npm run build` if `dist` missing. |
| **Interactive Terminal Login** | `npx akakce-mcp auth` | Prompt for email/password; writes `~/.config/akakce-mcp/session.json`. |
| **Direct Cookie Ingestion** | `npx akakce-mcp set-cookie "AAATLGST=..."` | Use when browser session is already active. |
| **Check Auth Status** | `npx akakce-mcp status` | Probes `/user/info` to verify token validity. |
| **Clear Local Session** | `npx akakce-mcp logout` | Safely removes local session file. |

---

## 2. Architecture & Anti-Bot Protection Contracts

### A. The Akamai Bot Defense Seam
- **The Challenge:** Akakçe routes product pages and critical endpoints behind Akamai bot management. Standard Node.js `fetch` or Axios clients fail with `HTTP 403 Forbidden` due to TLS/HTTP2 client fingerprinting.
- **The Hardened Resolution:** `client.ts` uses system `curl` (`child_process.execFile`) with browser and native-app User-Agents (`Akakce/100 CFNetwork/...` and Chrome 148). This guarantees zero 403 blocks for public and private endpoints.

### B. Dual Authentication Mechanism
1. **Public Tools (No Auth Required):** `akakce_search`, `akakce_autocomplete`, `akakce_search_filters`, `akakce_category_browse`, `akakce_product_prices`, `akakce_quickview`, `akakce_product_detail`, `akakce_price_history`, `akakce_deals`, `akakce_home_feed`.
2. **Authenticated Tools:** `akakce_login`, `akakce_account_info`, `akakce_favorites`, `akakce_favorite_add`, `akakce_favorite_remove`, `akakce_price_alerts`, `akakce_price_alert_set`, `akakce_notifications`.
   - Requires the `AAATLGST` session cookie.
   - Checked in priority order:
     1. `AKAKCE_COOKIE` environment variable.
     2. `~/.config/akakce-mcp/session.json` (chmod 0600).
     3. Runtime `akakce_login` tool invocation.

### C. Zero Token Leakage Contract
- **Rule:** Agent sessions, test scripts, and commits must **NEVER** output or store plaintext authentication cookies into repository files, git commits, or environment exports.
- All session persistence is isolated to `~/.config/akakce-mcp/session.json` outside the workspace.

---

## 3. Tool Reference (20 Tools)

### Discovery & Search
- `akakce_autocomplete`: Instant search suggestions and product codes.
- `akakce_search`: Paginated search with filtering (`ctCode`, `filterIds`).
- `akakce_search_filters`: Available filter facets and price ranges for a search term.
- `akakce_category_browse`: Category hierarchy and category product feeds.
- `akakce_home_feed`: Featured campaigns, collections, and deals from home screen.
- `akakce_deals`: Real-time price drop feed across categories.

### Pricing & Store Intelligence
- `akakce_product_prices`: Batched live prices across multiple product codes.
- `akakce_quickview`: Single product rapid price lookup.
- `akakce_product_detail`: Complete seller listings, seller ratings, shipping fees, product specs, and direct checkout outbound links.
- `akakce_price_history`: Price trend graph image URL.

### User Account & Price Alerts
- `akakce_login`: Authenticate and persist session cookie.
- `akakce_logout`: Purge active session cookie.
- `akakce_account_info`: Current user profile and notification counters.
- `akakce_favorites`: List user favorite folders and items.
- `akakce_favorite_add` / `akakce_favorite_remove`: Manage wishlist items.
- `akakce_price_alerts`: Active target price monitors.
- `akakce_price_alert_set`: Arm price alert at a specified target price in TRY.
- `akakce_notifications`: Price drop notification stream.

### LLM Enrichment
- `akakce_llm_enrich`: Optional analysis over Akakçe JSON data using guarded LLM routers.
