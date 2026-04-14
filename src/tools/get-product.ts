import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GetProductInput } from "../schemas/get-product.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import { transformProductDetail } from "../transforms/index.js";
import { mapHertwillError } from "../errors/map.js";
import { HertwillApiError } from "../errors/api-error.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof GetProductInput>;

export function createGetProductHandler(deps: ToolDeps) {
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
      const raw = await deps.client.getProduct(args.product_id);
      const detail = transformProductDetail(raw.data);
      const variationCount = detail.variations.length;
      const variationText =
        variationCount === 0
          ? "no variations"
          : `${variationCount} variation${variationCount === 1 ? "" : "s"}`;
      const priceText = `€${detail.price.amount.toFixed(2)}`;
      const text = `Product ${detail.id}: "${raw.data.name}" — ${priceText}, stock ${detail.stock.stock_level}, ${variationText}.`;
      return {
        structuredContent: detail as unknown as Record<string, unknown>,
        content: [{ type: "text", text }],
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
      return mapped as CallToolResult;
    }
  };
}

export function registerGetProduct(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "get_product",
    {
      description: TOOL_DESCRIPTIONS.get_product,
      inputSchema: GetProductInput.shape,
    },
    createGetProductHandler(deps),
  );
}
