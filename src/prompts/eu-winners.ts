import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PROMPT_DESCRIPTIONS } from "./descriptions.js";
import {
  DiscoveryOptionalArgs,
  buildFilterNote,
  buildVatNote,
} from "./shared-args.js";
import type { PromptDeps } from "./types.js";

function buildInstructions(
  args: Record<string, string | undefined>,
): string {
  const filterNote = buildFilterNote(args);
  const vatNote = args.vat_rate
    ? buildVatNote(args.vat_rate)
    : "Use a default VAT rate of 0.20 (20%) for margin calculations -- EU standard.";

  return [
    "You are running a Hertwill EU Winners scan to find high-margin products available for European fulfillment.",
    "",
    filterNote,
    "",
    "IMPORTANT: All searches MUST include `shipping_region: \"eu\"` to filter for EU-shippable products only.",
    "",
    "Follow these steps:",
    "",
    "1. Call `search_products` with `shipping_region` set to `eu` to find EU-shippable products. Search for popular, trending, or high-demand product terms.",
    "2. For the top 10 results, call `evaluate_product` on each to get a factual scorecard (margin band, stock, EU shipping, variant count).",
    "3. For products that look promising, call `calculate_margin` with the product cost, a reasonable retail markup (2x-3x wholesale), estimated ad spend, and VAT rate.",
    `   ${vatNote}`,
    "4. Rank products by net margin percentage (descending) and filter out any that are out of stock.",
    "5. Present a shortlist of the top 5 EU winners in a table showing: product name, wholesale price, suggested retail, margin %, stock status, variant count, and shipping details.",
    "6. For each winner, highlight EU-specific advantages:",
    "   - DDP (Delivered Duty Paid) vs DDU (Delivered Duty Unpaid) status",
    "   - Estimated lead times for EU delivery",
    "   - EU warehouse availability if indicated",
    "   - VAT implications for the listed margin",
    "",
    "Show your reasoning at each step so the user can follow your sourcing logic.",
  ].join("\n");
}

export function registerEuWinners(
  server: McpServer,
  _deps: PromptDeps,
): void {
  server.registerPrompt(
    "hw-eu-winners",
    {
      title: "EU Winners",
      description: PROMPT_DESCRIPTIONS["hw-eu-winners"],
      argsSchema: DiscoveryOptionalArgs,
    },
    async (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: buildInstructions(args),
          },
        },
      ],
    }),
  );
}
