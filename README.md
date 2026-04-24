# @hertwill/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that wraps the [Hertwill](https://hertwill.com) dropshipping API — letting any MCP-capable AI agent discover products, evaluate margins, manage an import list, and trigger syncs to Shopify/WooCommerce through natural language.

```bash
npx @hertwill/mcp
```

## Quick Start

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "hertwill": {
      "command": "npx",
      "args": ["@hertwill/mcp"],
      "env": {
        "HERTWILL_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "hertwill": {
      "command": "npx",
      "args": ["@hertwill/mcp"],
      "env": {
        "HERTWILL_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### VS Code + Copilot

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "hertwill": {
      "type": "stdio",
      "command": "npx",
      "args": ["@hertwill/mcp"],
      "env": {
        "HERTWILL_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Cline / Continue / Windsurf

Each follows the same pattern — add an MCP server entry pointing to `npx @hertwill/mcp` with the `HERTWILL_API_KEY` env var. Refer to your client's MCP configuration docs.

> **No API key?** The server starts without one. All 6 discovery tools work immediately — you only need a key for import list and sync operations. Get one at [hertwill.com](https://hertwill.com).

## What You Can Ask

Once connected, talk to your AI agent naturally:

- *"Find me winning EU-shippable kitchen gadgets under €25"*
- *"Evaluate product 4827 — is the margin viable for Facebook ads?"*
- *"Show me trending pet supplies with at least 60% margin potential"*
- *"Add products 1001, 1002, 1003 to my import list"*
- *"What's the health of my store connection?"*

## Tools (12)

### Discovery (no API key required)

| Tool | Purpose |
|------|---------|
| `search_products` | Hybrid keyword + semantic search with filters (category, brand, price, stock, EU shipping) |
| `list_products` | Browse and filter catalog without a search query |
| `get_product` | Full product detail — variants, shipping regions, descriptions |
| `evaluate_product` | Factual viability scorecard: margin inputs, shipping, stock, variant spread |
| `calculate_margin` | Pure-math break-even and margin calculator (no network call) |
| `check_health` | Server version, API reachability, rate limit bucket state |

### Import & Sync (API key required)

| Tool | Purpose |
|------|---------|
| `check_auth` | Validate API key format and authentication status |
| `list_import_list` | View products in your import list |
| `add_to_import_list` | Add products by ID to your import list |
| `remove_from_import_list` | Remove a product from your import list |
| `get_sync_jobs` | Check Shopify/WooCommerce sync job status |
| `sync_products` | Trigger a product sync to your connected store |

## Prompts (8)

Pre-built workflows the agent can invoke as structured starting points:

| Prompt | Purpose |
|--------|---------|
| `hw-winner-scan` | Search, evaluate, and calculate margin in one flow |
| `hw-niche-research` | Deep-dive a niche with category + brand analysis |
| `hw-eu-winners` | Find EU-shippable winners with margin analysis |
| `hw-seasonal-picks` | Discover products for a specific season |
| `hw-competitor-match` | Find Hertwill alternatives to a competitor product |
| `hw-margin-check` | Single-product margin deep dive |
| `hw-import-batch` | Bulk import with mandatory user confirmation |
| `hw-store-health` | Full store diagnostic: auth, API, import list, sync jobs |

## Resources (5)

Static and dynamic context the agent can read:

| Resource | URI |
|----------|-----|
| Categories taxonomy | `hertwill://taxonomy/categories` |
| Brands taxonomy | `hertwill://taxonomy/brands` |
| Product JSON Schema | `hertwill://schemas/product` |
| Rate limits guide | `hertwill://docs/rate-limits` |
| EU shipping guide | `hertwill://docs/eu-shipping` |

## Configuration

| Environment Variable | Required | Default | Description |
|---------------------|----------|---------|-------------|
| `HERTWILL_API_KEY` | No | — | Hertwill API key (`hw_live_...`). Enables import list and sync tools. |
| `HERTWILL_MCP_LOG_LEVEL` | No | `info` | Log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `HERTWILL_MCP_TELEMETRY` | No | `false` | Set to `true` to enable opt-in telemetry (no PII collected) |

## Troubleshooting

### "Parse error" or garbled output from the MCP client

**Cause:** Something is writing to stdout besides JSON-RPC frames. Common culprits: an npm lifecycle script printing a banner, or a stray `console.log` in a dependency.

**Fix:** Ensure you're using `npx @hertwill/mcp` directly (not wrapping it in a shell script that echoes). Logs go to stderr, never stdout.

### "Unauthorized" or "Invalid API key format"

**Cause:** The `HERTWILL_API_KEY` env var is missing, empty, or doesn't match the `hw_live_...` / `hw_test_...` format.

**Fix:** Check the key is set in your MCP client config (not your shell profile — MCP servers don't inherit your shell environment). Get a key at [hertwill.com](https://hertwill.com).

### "Rate limit exceeded. Retry after Xs."

**Cause:** You've hit the Hertwill API rate limit (60 req/min public, 300 req/min authenticated).

**Fix:** The server handles backoff automatically. Wait for the indicated retry period. If you're hitting limits frequently, batch your requests — use `hw-import-batch` instead of individual `add_to_import_list` calls.

## Development

```bash
# Install dependencies
pnpm install

# Run in development
pnpm tsx src/index.ts

# Run tests (436 tests)
pnpm test

# Build
pnpm build

# Full validation (build + lint + security gates + tests)
pnpm validate
```

### Security Gates

The `validate` script includes four security gates that run in CI:

- **check:key-reads** — `process.env.HERTWILL_API_KEY` accessed only in `src/config.ts`
- **check:key-leakage** — no full-length API key values in the source tree
- **check:boundaries** — import boundary enforcement between layers
- **audit** — `pnpm audit --audit-level=high` passes with zero high-severity CVEs

## Tech Stack

- **Runtime:** Node.js >= 20.11, ESM-only
- **MCP SDK:** `@modelcontextprotocol/sdk` ^1.29
- **Validation:** Zod v4
- **HTTP:** Native `fetch` + `openapi-fetch` (typed, 6 KB)
- **Rate limiting:** Bottleneck (60/min public, 300/min authenticated)
- **Retry:** p-retry with exponential backoff + jitter
- **Logging:** Pino to stderr (stdout reserved for JSON-RPC)
- **Build:** tsup (ESM bundle with shebang)
- **Testing:** Vitest + MSW + in-process MCP client

## License

MIT
