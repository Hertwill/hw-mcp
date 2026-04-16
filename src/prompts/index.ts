import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCompetitorMatch } from "./competitor-match.js";
import { registerEuWinners } from "./eu-winners.js";
import { registerImportBatch } from "./import-batch.js";
import { registerMarginCheck } from "./margin-check.js";
import { registerNicheResearch } from "./niche-research.js";
import { registerSeasonalPicks } from "./seasonal-picks.js";
import { registerStoreHealth } from "./store-health.js";
import type { PromptDeps } from "./types.js";
import { registerWinnerScan } from "./winner-scan.js";

/**
 * Register all Hertwill MCP prompts.
 *
 * Called from `createServer()` unconditionally -- all prompts compose
 * existing tools and return instruction messages for the agent.
 */
export function registerPrompts(server: McpServer, deps: PromptDeps): void {
  // Discovery prompts (public tools)
  registerWinnerScan(server, deps);
  registerNicheResearch(server, deps);
  registerEuWinners(server, deps);
  registerSeasonalPicks(server, deps);
  registerCompetitorMatch(server, deps);

  // Authenticated prompts
  registerMarginCheck(server, deps);
  registerImportBatch(server, deps);
  registerStoreHealth(server, deps);
}

export type { PromptDeps } from "./types.js";
