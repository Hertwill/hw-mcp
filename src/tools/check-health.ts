import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CheckHealthInput } from "../schemas/check-health.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import type { ToolDeps, HealthCacheEntry } from "./types.js";

const HEALTH_CACHE_TTL_MS = 5_000;

const PUBLIC_LIMIT = 60;
const AUTH_LIMIT = 300;

function isoFromOffset(secondsFromNow: number | undefined): string | null {
  if (secondsFromNow === undefined) return null;
  return new Date(Date.now() + secondsFromNow * 1000).toISOString();
}

/**
 * D-15: full bucket state for both public and authenticated rate limiters.
 *
 * Per T-4-04, this handler MUST NOT throw. The reachability probe is wrapped
 * in try/catch and a probe failure surfaces as `hertwill_reachable: false`,
 * `hertwill_latency_ms: null` — never as an MCP error envelope.
 */
export function createCheckHealthHandler(deps: ToolDeps) {
  return async (): Promise<CallToolResult> => {
    // Reachability probe with 5s memoisation (avoids probe storms).
    let probe: HealthCacheEntry | undefined = deps.healthCache.get();
    const now = Date.now();
    if (!probe || now - probe.checkedAt > HEALTH_CACHE_TTL_MS) {
      try {
        const res = await deps.client.health();
        probe = { ok: res.ok, latency_ms: res.latency_ms, checkedAt: now };
      } catch {
        probe = { ok: false, latency_ms: null, checkedAt: now };
      }
      deps.healthCache.set(probe);
    }

    // Bottleneck reservoir snapshots
    let publicRemaining: number | null = null;
    let authRemaining: number | null = null;
    try {
      const r = await deps.publicLimiter.currentReservoir();
      publicRemaining = r;
    } catch {
      publicRemaining = null;
    }

    if (deps.apiKey !== undefined) {
      try {
        const r = await deps.authLimiter.currentReservoir();
        authRemaining = r;
      } catch {
        authRemaining = null;
      }
    }

    const publicResetAt =
      isoFromOffset(deps.publicRateReset.secondsRemaining()) ??
      isoFromOffset(60);
    const authResetAt =
      deps.apiKey !== undefined
        ? (isoFromOffset(deps.authRateReset.secondsRemaining()) ??
          isoFromOffset(60))
        : null;

    const structured = {
      server_version: deps.serverVersion,
      hertwill_reachable: probe.ok,
      hertwill_latency_ms: probe.latency_ms,
      rate_limits: {
        public: {
          remaining: publicRemaining,
          limit: PUBLIC_LIMIT,
          reset_at: publicResetAt,
        },
        authenticated: {
          configured: deps.apiKey !== undefined,
          remaining: deps.apiKey !== undefined ? authRemaining : null,
          limit: deps.apiKey !== undefined ? AUTH_LIMIT : null,
          reset_at: authResetAt,
        },
      },
    };

    const reachText = probe.ok
      ? `Hertwill API reachable (${probe.latency_ms}ms)`
      : "Hertwill API unreachable";
    const authText = deps.apiKey !== undefined ? "auth bucket configured" : "no API key (public-only)";
    const text = `${reachText}. Server v${deps.serverVersion}. Public bucket: ${publicRemaining ?? "?"}/${PUBLIC_LIMIT}. ${authText}.`;

    return {
      structuredContent: structured as unknown as Record<string, unknown>,
      content: [{ type: "text", text }],
    };
  };
}

export function registerCheckHealth(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "check_health",
    {
      description: TOOL_DESCRIPTIONS.check_health,
      inputSchema: CheckHealthInput.shape,
    },
    createCheckHealthHandler(deps),
  );
}
