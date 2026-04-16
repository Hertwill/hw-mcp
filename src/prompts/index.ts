import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEuWinners } from "./eu-winners.js";
import { registerNicheResearch } from "./niche-research.js";
import type { PromptDeps } from "./types.js";
import { registerWinnerScan } from "./winner-scan.js";

/**
 * Register all Hertwill MCP discovery prompts.
 *
 * Called from `createServer()` unconditionally -- discovery prompts
 * compose only public tools and need no API key.
 *
 * Phase 7 Plan 2 will add hw-margin-check, hw-import-batch,
 * hw-store-health here.
 */
export function registerPrompts(server: McpServer, deps: PromptDeps): void {
  registerWinnerScan(server, deps);
  registerNicheResearch(server, deps);
  registerEuWinners(server, deps);
}

export type { PromptDeps } from "./types.js";
