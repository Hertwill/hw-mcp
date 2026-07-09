import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { HertwillApiError } from "../errors/api-error.js";
import { mapHertwillError } from "../errors/map.js";
import {
  TOOL_ANNOTATIONS,
  TOOL_DESCRIPTIONS,
  TOOL_TITLES,
} from "../schemas/descriptions.js";
import { SearchProductsInput } from "../schemas/search-products.js";
import {
  pricingHint,
  transformPagination,
  transformProductListItem,
} from "../transforms/index.js";
import { clampPerPage, toolResult } from "./helpers.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof SearchProductsInput>;

export function createSearchProductsHandler(deps: ToolDeps) {
  return async (args: Args): Promise<CallToolResult> => {
    // 1. Pre-flight reservoir check (D-12)
    const reservoir = await deps.publicLimiter.currentReservoir();
    if (reservoir !== null && reservoir <= 0) {
      const retryAfter = deps.publicRateReset.secondsRemaining() ?? 60;
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Rate limit exceeded. Retry after ${retryAfter}s.`,
          },
        ],
      };
    }

    // 2. Per-page clamp (Phase 3 inherited constraint)
    const { value: per_page, clamped } = clampPerPage(args.per_page);

    try {
      const raw = await deps.client.searchProducts({
        q: args.query,
        page: args.page,
        per_page,
        brand: args.brand,
        category: args.category,
        min_price: args.min_price,
        max_price: args.max_price,
        on_sale: args.on_sale,
        stock_status: args.stock_status,
        shipping_region: args.shipping_region,
        sort_by: args.sort_by,
        sort_order: args.sort_order,
      });
      const items = raw.data.map(transformProductListItem);
      const { pagination, hints: baseHints } = transformPagination(
        raw.meta.pagination,
        "search_products",
      );
      const hints = pagination.has_more
        ? baseHints
        : {
            next_step: "Use get_product(id) for full detail on any item.",
          };
      const { pricing, note: pricingNote } = pricingHint(raw.meta);
      const envelope = {
        items,
        pagination,
        hints,
        ...(pricing && { pricing }),
      };
      const clampNote = clamped
        ? ` (clamped to ${per_page} from requested ${args.per_page} for token budget)`
        : "";
      const countText =
        items.length === 0
          ? `No products found for "${args.query}".`
          : `Found ${items.length} product(s) matching "${args.query}" (page ${pagination.page}${
              pagination.has_more ? ", more available" : ""
            })${clampNote}.${pricingNote}`;
      return toolResult(
        envelope as unknown as Record<string, unknown>,
        countText,
      );
    } catch (err) {
      const mapped = mapHertwillError(err);
      if (
        err instanceof HertwillApiError &&
        err.retryAfterSeconds !== undefined &&
        mapped.content[0]?.type === "text"
      ) {
        mapped.content[0].text = `Retry after ${err.retryAfterSeconds}s. ${mapped.content[0].text}`;
      }
      return mapped as CallToolResult;
    }
  };
}

export function registerSearchProducts(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    "search_products",
    {
      title: TOOL_TITLES.search_products,
      description: TOOL_DESCRIPTIONS.search_products,
      inputSchema: SearchProductsInput.shape,
      annotations: TOOL_ANNOTATIONS.search_products,
    },
    createSearchProductsHandler(deps),
  );
}
