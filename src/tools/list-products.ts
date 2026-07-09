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
import { ListProductsInput } from "../schemas/list-products.js";
import {
  pricingHint,
  transformPagination,
  transformProductListItem,
} from "../transforms/index.js";
import { clampPerPage, toolResult } from "./helpers.js";
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
      const { pricing, note: pricingNote } = pricingHint(raw.meta);
      const envelope = {
        items,
        pagination,
        hints,
        ...(pricing && { pricing }),
      };
      const clampNote = clamped
        ? ` (per_page reduced to 20 from requested ${args.per_page} to stay within token budget)`
        : "";
      const countText =
        items.length === 0
          ? "No products match these filters."
          : `Listing ${items.length} product(s) (page ${pagination.page}${
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

export function registerListProducts(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "list_products",
    {
      title: TOOL_TITLES.list_products,
      description: TOOL_DESCRIPTIONS.list_products,
      inputSchema: ListProductsInput.shape,
      annotations: TOOL_ANNOTATIONS.list_products,
    },
    createListProductsHandler(deps),
  );
}
