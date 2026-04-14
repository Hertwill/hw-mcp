/**
 * Shared helpers for MCP tool handlers.
 *
 * Pure utilities — no MCP SDK imports allowed here (tool files own that
 * boundary). Consumed by every list-shaped public tool in Phase 4 and every
 * authenticated tool in Phase 5.
 */

import type { ToolDeps } from "./types.js";

/**
 * MCP error envelope shape mirrored from src/errors/map.ts. Kept as a local
 * re-declaration rather than an import to avoid a helpers→errors dependency
 * for the common "no key configured" branch (D-21 defence-in-depth).
 */
export interface McpToolError {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
}

/**
 * Defence-in-depth guard for authenticated tool handlers (D-21).
 *
 * Returns `null` when `deps.apiKey` is a non-empty string — the handler MUST
 * proceed. Otherwise returns a ready-made MCP error envelope with setup
 * instructions so agents can self-serve. Every authenticated handler calls
 * this as its first line before the reservoir pre-flight.
 *
 * Under normal flow (createServer() only registers auth tools when apiKey is
 * set per D-24) this guard never fires. It stays as insurance for future
 * refactors that might register tools unconditionally.
 */
export function requireApiKey(deps: ToolDeps): McpToolError | null {
  if (typeof deps.apiKey === "string" && deps.apiKey.length > 0) return null;
  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          "This tool requires HERTWILL_API_KEY. Set it in your MCP server config " +
          "(see https://hertwill.com/app/api-keys). No authenticated action taken.",
      },
    ],
  };
}

/**
 * Maximum number of list items an MCP tool may return in a single response.
 *
 * Derived from the Phase 3 CONTRACT-08 token budget: with a worst-case list
 * item payload, 20 items comfortably fits under the 4K-token ceiling while
 * 50 (the OpenAPI schema maximum) does not. Handlers clamp `per_page` to this
 * value and announce the clamp in the text summary so agents know they are
 * receiving a truncated page.
 */
export const MCP_LIST_PAGE_CEILING = 20;

/**
 * Clamp a caller-supplied `per_page` value to the MCP list ceiling.
 *
 * Returns the value the handler should forward to the Hertwill client and a
 * flag indicating whether clamping occurred (so the text summary can say
 * "clamped to 20 for token budget"). Undefined requests default to the
 * ceiling without being marked as clamped.
 */
export function clampPerPage(requested?: number): {
  value: number;
  clamped: boolean;
} {
  const req = requested ?? MCP_LIST_PAGE_CEILING;
  return {
    value: Math.min(req, MCP_LIST_PAGE_CEILING),
    clamped: req > MCP_LIST_PAGE_CEILING,
  };
}
