import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "./config.js";
import { HertwillClient } from "./hertwill/client.js";
import {
  defaultRegistry,
  type RateLimiterRegistry,
} from "./hertwill/rate-limiter.js";
import { logger } from "./logger.js";
import { type PromptDeps, registerPrompts } from "./prompts/index.js";
import {
  createTaxonomyCache,
  type ResourceDeps,
  registerResources,
} from "./resources/index.js";
import {
  registerAuthenticatedTools,
  registerPublicTools,
  type ToolDeps,
} from "./tools/index.js";
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
  /**
   * Rate limiter registry for per-key bucket isolation. If omitted, the
   * default module-level registry is used (shared singletons — correct
   * for stdio single-user mode).
   */
  registry?: RateLimiterRegistry;
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

  const registry = overrides?.registry ?? defaultRegistry;
  const limiters = registry.get(apiKey);
  const client = new HertwillClient({
    apiKey,
    limiter: apiKey ? limiters.auth : limiters.public,
  });
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
    mcpServer: server,
    publicLimiter: limiters.public,
    authLimiter: limiters.auth,
    logger,
    serverVersion: pkg.version,
    apiKey,
    publicRateReset: new RateResetTracker(),
    authRateReset: new RateResetTracker(),
    healthCache,
  };

  registerPublicTools(server, deps);
  logger.info({ tools: 6 }, "Registered public Hertwill tools");

  // D-24: register authenticated tools only when an API key is configured.
  if (typeof apiKey === "string" && apiKey.length > 0) {
    registerAuthenticatedTools(server, deps);
    logger.info({ tools: 6 }, "Registered authenticated Hertwill tools");
  }

  // D-29: register all 5 resources UNCONDITIONALLY — taxonomy endpoints are
  // public on Hertwill's side; schema + docs resources are static.
  const taxonomyCache = createTaxonomyCache();
  const resourceDeps: ResourceDeps = { ...deps, taxonomyCache };
  registerResources(server, resourceDeps);
  logger.info({ resources: 5 }, "Registered Hertwill MCP resources");

  // Phase 7: register all 8 prompts UNCONDITIONALLY — prompts return
  // instruction messages, not tool results. Auth-dependent tools are
  // referenced in instructions; availability is checked at execution time.
  const promptDeps: PromptDeps = deps;
  registerPrompts(server, promptDeps);
  logger.info({ prompts: 8 }, "Registered Hertwill MCP prompts");

  return server;
}
