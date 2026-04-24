import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PROMPT_DESCRIPTIONS } from "./descriptions.js";
import {
  buildFilterNote,
  buildVatNote,
  DiscoveryOptionalArgs,
} from "./shared-args.js";
import type { PromptDeps } from "./types.js";

function buildInstructions(args: Record<string, string | undefined>): string {
  const filterNote = buildFilterNote(args);
  const vatNote = buildVatNote(args.vat_rate);

  return [
    "You are running a Hertwill Winner Scan to find high-margin dropshipping products.",
    "",
    filterNote,
    "",
    "Follow these steps:",
    "",
    "1. Call `search_products` to find candidate products. Search for popular, trending, or high-demand product terms.",
    `   ${filterNote !== "Search broadly across the catalog." ? "Include the filters above in your search." : ""}`,
    "2. For the top 10 results, call `evaluate_product` on each to get a factual scorecard (margin band, stock, EU shipping, variant count).",
    "3. For products that look promising, call `calculate_margin` with the product cost, a reasonable retail markup (2x-3x wholesale), estimated ad spend, and VAT rate.",
    `   ${vatNote}`,
    "4. Rank products by net margin percentage (descending) and filter out any that are out of stock.",
    "5. Present a shortlist of the top 5 winners in a table showing: product name, wholesale price, suggested retail, margin %, stock status, EU-shippable (yes/no), and variant count.",
    "6. For each winner, explain WHY it is a good pick (margin, demand signals, shipping advantage).",
    "",
    "Show your reasoning at each step so the user can follow your sourcing logic.",
  ].join("\n");
}

export function registerWinnerScan(server: McpServer, _deps: PromptDeps): void {
  server.registerPrompt(
    "hw-winner-scan",
    {
      title: "Winner Scan",
      description: PROMPT_DESCRIPTIONS["hw-winner-scan"],
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
