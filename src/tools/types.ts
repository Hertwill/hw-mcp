import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type Bottleneck from "bottleneck";
import type { Logger } from "pino";
import type { HertwillClient } from "../hertwill/client.js";
import type { RateResetTracker } from "./rate-reset.js";

/**
 * Cached snapshot of the most recent `/health` probe, used by
 * `check_health` to avoid probe storms on rapid successive calls.
 */
export interface HealthCacheEntry {
  ok: boolean;
  latency_ms: number | null;
  /** epoch ms of the probe that produced this snapshot */
  checkedAt: number;
}

/**
 * Dependencies passed to every MCP tool handler's `registerXxx(server, deps)`
 * function. Constructed once in `createServer()` and shared across all tools.
 *
 * The auth pair (`authLimiter` + `authRateReset`) is always supplied so
 * authenticated tools (Phase 5) can re-use the same plumbing; public tools
 * (Phase 4) read only the `public*` fields.
 */
export interface ToolDeps {
  client: HertwillClient;
  mcpServer: McpServer;
  publicLimiter: Bottleneck;
  authLimiter: Bottleneck;
  logger: Logger;
  serverVersion: string;
  apiKey: string | undefined;
  publicRateReset: RateResetTracker;
  authRateReset: RateResetTracker;
  healthCache: {
    get(): HealthCacheEntry | undefined;
    set(entry: HealthCacheEntry): void;
  };
}
