import type { ToolDeps } from "../tools/types.js";

/**
 * Dependencies for MCP prompt handlers.
 * Currently identical to ToolDeps -- prompts compose tools
 * but don't need additional infrastructure.
 */
export type PromptDeps = ToolDeps;
