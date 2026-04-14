import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { EvaluateProductInput } from "../schemas/evaluate-product.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import {
  transformShipsTo,
  transformStockInfo,
  wrapUntrustedContent,
} from "../transforms/index.js";
import { mapHertwillError } from "../errors/map.js";
import { HertwillApiError } from "../errors/api-error.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof EvaluateProductInput>;

/**
 * Factual scorecard for a single product (D-13).
 *
 * NO numeric score, NO opinionated ranking, NO verdict — the agent synthesizes
 * any judgement from these raw facts.
 */
interface EvaluateProductScorecard {
  product_id: number;
  name: string; // wrapped in <untrusted_supplier_content>
  margin_inputs: {
    cost: number;
    msrp: number;
    currency: "EUR";
  };
  shipping_regions: string[]; // ISO codes via transformShipsTo
  variant_count: number;
  eu_shippable: boolean;
  stock_state: "in_stock" | "low" | "out_of_stock";
  is_on_sale: boolean;
  has_variants: boolean;
}

export function createEvaluateProductHandler(deps: ToolDeps) {
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
      const d = raw.data;
      const regions = transformShipsTo(d.shipping_regions);
      const stock = transformStockInfo(
        d.stock_status as "instock" | "outofstock",
        d.stock,
      );
      const variations = d.variations ?? [];
      const scorecard: EvaluateProductScorecard = {
        product_id: d.id,
        name: wrapUntrustedContent(d.name, d.id),
        margin_inputs: {
          cost: d.price,
          msrp: d.sale_price ?? d.price,
          currency: "EUR",
        },
        shipping_regions: regions,
        variant_count: variations.length,
        eu_shippable: regions.includes("EU"),
        stock_state: stock.stock_level,
        is_on_sale: d.sale_price !== null && d.sale_price !== undefined,
        has_variants: variations.length > 0,
      };
      const text = `Scorecard for product ${d.id}: stock ${scorecard.stock_state}, ${scorecard.variant_count} variation(s), ships to ${regions.length} region(s)${scorecard.eu_shippable ? " (incl. EU)" : ""}${scorecard.is_on_sale ? ", on sale" : ""}.`;
      return {
        structuredContent: scorecard as unknown as Record<string, unknown>,
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

export function registerEvaluateProduct(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    "evaluate_product",
    {
      description: TOOL_DESCRIPTIONS.evaluate_product,
      inputSchema: EvaluateProductInput.shape,
    },
    createEvaluateProductHandler(deps),
  );
}
