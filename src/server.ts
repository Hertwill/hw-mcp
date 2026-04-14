import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "./config.js";
import { HertwillClient } from "./hertwill/client.js";
import { authLimiter, publicLimiter } from "./hertwill/rate-limiter.js";
import { logger } from "./logger.js";
import { registerPublicTools, type ToolDeps } from "./tools/index.js";
import { RateResetTracker } from "./tools/rate-reset.js";
import type { HealthCacheEntry } from "./tools/types.js";

// Read package.json via fs (NOT `import ... with { type: "json" }`) — tsconfig
// does not enable `resolveJsonModule`, so the import-attribute form would fail
// type-check. The fs path is zero-config and works under the current setup.
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

export interface CreateServerOverrides {
  /**
   * Inject a specific API key (including explicit `undefined`) to bypass
   * `loadConfig()`'s env read. Tests use this to switch the auth-bucket
   * configured/unconfigured paths without touching `process.env`.
   */
  apiKey?: string | undefined;
}

/**
 * Build the Hertwill MCP server with all 6 public tools registered.
 *
 * Safe to call with no `HERTWILL_API_KEY` set — public tools work without a
 * key. Phase 5 will extend this to conditionally register authenticated
 * tools when a key is configured.
 *
 * FOUND-05 boundary: the API-key env var is read only by `loadConfig()` in
 * `src/config.ts` — `createServer` consumes the parsed Config, never the env.
 */
export function createServer(overrides?: CreateServerOverrides): McpServer {
  const config = loadConfig();
  const apiKey =
    overrides && "apiKey" in overrides
      ? overrides.apiKey
      : config.hertwillApiKey;

  const client = new HertwillClient({ apiKey });
  const server = new McpServer({
    name: "hertwill-mcp",
    version: pkg.version,
  });

  // Inline 5s-TTL health cache. Kept here (not in a separate module) because
  // `createServer` is the only caller that constructs it.
  let cached: HealthCacheEntry | undefined;
  const healthCache = {
    get: () => cached,
    set: (entry: HealthCacheEntry) => {
      cached = entry;
    },
  };

  const deps: ToolDeps = {
    client,
    publicLimiter,
    authLimiter,
    logger,
    serverVersion: pkg.version,
    apiKey,
    publicRateReset: new RateResetTracker(),
    authRateReset: new RateResetTracker(),
    healthCache,
  };

  registerPublicTools(server, deps);
  logger.info({ tools: 6 }, "Registered public Hertwill tools");
  return server;
}
