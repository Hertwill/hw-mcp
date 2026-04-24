import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { CalculateMarginInput } from "../schemas/calculate-margin.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import { toolResult } from "./helpers.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof CalculateMarginInput>;

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Pure-math break-even and margin calculator.
 *
 * D-14 (VAT-inclusive model — user-selected override): the VAT amount is
 * reported informationally but is NOT subtracted from gross margin. EU
 * sellers should treat this as a quick-check tool, not a tax calculator —
 * the text summary makes that caveat explicit.
 *
 * Pure: zero network calls, no client/SDK dependency. Verified by msw's
 * onUnhandledRequest:"error" plus a source grep in the test.
 */
// biome-ignore lint/correctness/noUnusedFunctionParameters: deps kept for symmetry across tool handler signatures
export function createCalculateMarginHandler(_deps: ToolDeps) {
  return async (args: Args): Promise<CallToolResult> => {
    const cost = args.cost;
    const retail = args.retail_price;
    const adSpend = args.ad_spend ?? 0;
    const vatRate = args.vat_rate ?? 0;

    const grossMargin = round2(retail - cost - adSpend);
    const marginPct = round3(grossMargin / retail);
    const vatOwed = round2(retail * (vatRate / (1 + vatRate)));
    const margin = retail - cost;
    const breakEven = {
      breakeven: round2(margin / 1),
      conservative_2x: round2(margin / 2),
      aggressive_3x: round2(margin / 3),
    };

    const lossNote = grossMargin < 0 ? " ⚠ LOSS" : "";
    const text =
      `Gross margin €${grossMargin.toFixed(2)} (${Math.round(marginPct * 100)}%)${lossNote}. ` +
      `Break-even ad spend: €${breakEven.breakeven.toFixed(2)} (1×), €${breakEven.conservative_2x.toFixed(2)} (2×), €${breakEven.aggressive_3x.toFixed(2)} (3×). ` +
      `VAT (informational, NOT subtracted from margin): €${vatOwed.toFixed(2)}. ` +
      `Note: VAT-inclusive model — for tax filing, use a dedicated calculator.`;

    const result = {
      cost,
      retail_price: retail,
      ad_spend: adSpend,
      vat_rate: vatRate,
      currency: "EUR",
      gross_margin: grossMargin,
      margin_pct: marginPct,
      vat_owed_informational: vatOwed,
      break_even_ad_spend: breakEven,
      _display: {
        type: "metric",
        primary: {
          label: "Gross Margin",
          value: "margin_pct",
          format: "percent",
        },
        secondary: [
          {
            label: "Break-even Ad Spend",
            value: "break_even_ad_spend.breakeven",
            format: "currency_eur",
          },
        ],
        ...(grossMargin < 0
          ? { alert: { level: "warning", message: "LOSS" } }
          : {}),
      },
    };
    return toolResult(result as Record<string, unknown>, text);
  };
}

export function registerCalculateMargin(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    "calculate_margin",
    {
      description: TOOL_DESCRIPTIONS.calculate_margin,
      inputSchema: CalculateMarginInput.shape,
    },
    createCalculateMarginHandler(deps),
  );
}
