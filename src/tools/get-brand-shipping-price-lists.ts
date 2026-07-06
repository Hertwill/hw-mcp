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
import { GetBrandShippingPriceListsInput } from "../schemas/get-brand-shipping-price-lists.js";
import { transformShippingPriceList } from "../transforms/index.js";
import { toolResult } from "./helpers.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof GetBrandShippingPriceListsInput>;

export function createGetBrandShippingPriceListsHandler(deps: ToolDeps) {
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

    try {
      const origin = args.origin ? args.origin.toUpperCase() : undefined;
      const raw = await deps.client.getBrandShippingPriceLists(
        args.brand_id,
        origin,
      );
      const lists = (raw.data ?? []).map(transformShippingPriceList);
      const originNote = origin ? ` from ${origin}` : "";
      const text =
        lists.length === 0
          ? `Brand ${args.brand_id} has no shipping price lists${originNote}.`
          : `Brand ${args.brand_id}: ${lists.length} shipping price list(s)${originNote} — ${lists
              .map((l) => l.name)
              .join(", ")}.`;
      return toolResult({ data: lists } as Record<string, unknown>, text);
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

export function registerGetBrandShippingPriceLists(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    "get_brand_shipping_price_lists",
    {
      title: TOOL_TITLES.get_brand_shipping_price_lists,
      description: TOOL_DESCRIPTIONS.get_brand_shipping_price_lists,
      inputSchema: GetBrandShippingPriceListsInput.shape,
      annotations: TOOL_ANNOTATIONS.get_brand_shipping_price_lists,
    },
    createGetBrandShippingPriceListsHandler(deps),
  );
}
