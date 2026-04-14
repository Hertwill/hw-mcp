import type { PaginationMeta } from "../hertwill/schemas/common.js";
import type { McpHints, McpPagination } from "./types.js";

/**
 * CONTRACT-08: Transform raw pagination meta to MCP envelope pieces.
 * Adds `has_more` boolean (computed from page < page_count) and a `hints.next_step`
 * string telling the agent exactly how to fetch the next page (or that it's done).
 */
export function transformPagination(
  meta: PaginationMeta,
  toolName: string,
): { pagination: McpPagination; hints: McpHints } {
  const hasMore = meta.page < meta.page_count;
  return {
    pagination: {
      page: meta.page,
      per_page: meta.per_page,
      total: meta.total,
      has_more: hasMore,
    },
    hints: {
      next_step: hasMore
        ? `Call ${toolName} with page: ${meta.page + 1} to see more results.`
        : "This is the last page of results.",
    },
  };
}
