import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ListProductsInput } from "../schemas/list-products.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import {
  transformProductListItem,
  transformPagination,
} from "../transforms/index.js";
import { mapHertwillError } from "../errors/map.js";
import { HertwillApiError } from "../errors/api-error.js";
import { clampPerPage } from "./helpers.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof ListProductsInput>;

export function createListProductsHandler(deps: ToolDeps) {
  return async (args: Args): Promise<CallToolResult> => {
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

    const { value: per_page, clamped } = clampPerPage(args.per_page);

    try {
      const raw = await deps.client.listProducts({
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
        "list_products",
      );
      const hints = clamped
        ? {
            next_step:
              "Agent: token budget caps pages at 20 items. Use page=N+1 to continue browsing.",
          }
        : pagination.has_more
          ? baseHints
          : {
              next_step: "Use get_product(id) for full detail on any item.",
            };
      const envelope = { items, pagination, hints };
      const clampNote = clamped
        ? ` (per_page reduced to 20 from requested ${args.per_page} to stay within token budget)`
        : "";
      const countText =
        items.length === 0
          ? "No products match these filters."
          : `Listing ${items.length} product(s) (page ${pagination.page}${
              pagination.has_more ? ", more available" : ""
            })${clampNote}.`;
      return {
        structuredContent: envelope as unknown as Record<string, unknown>,
        content: [{ type: "text", text: countText }],
      };
    } catch (err) {
      const mapped = mapHertwillError(err);
      if (
        err instanceof HertwillApiError &&
        err.retryAfterSeconds !== undefined &&
        mapped.content[0]?.type === "text"
      ) {
        mapped.content[0].text = `Retry after ${err.retryAfterSeconds}s. ${mapped.content[0].text}`;
      }
      return mapped;
    }
  };
}

export function registerListProducts(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "list_products",
    {
      description: TOOL_DESCRIPTIONS.list_products,
      inputSchema: ListProductsInput.shape,
    },
    createListProductsHandler(deps),
  );
}
