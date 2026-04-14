/**
 * Shared helpers for MCP tool handlers.
 *
 * Pure utilities — no MCP SDK imports allowed here (tool files own that
 * boundary). Consumed by every list-shaped public tool in Phase 4.
 */

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
