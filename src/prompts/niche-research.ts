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
  const vatNote = buildVatNote(args.vat_rate);

  return [
    "You are running a Hertwill Niche Research analysis to identify profitable dropshipping niches.",
    "",
    filterNote,
    "",
    "Follow these steps:",
    "",
    "1. Call `search_products` with broad, trending, or high-demand product terms to explore the catalog.",
    "   Run multiple searches with different keywords to cover a wide range of niches.",
    "2. Analyze the results: group products by category and brand. Count the number of SKUs in each group.",
    "3. Identify sub-niches that have at least 20 SKUs -- niches with fewer products may lack sufficient variety for a viable store.",
    "4. For the top 3 most promising niches, call `evaluate_product` on 2-3 representative products to assess quality, stock health, and EU coverage.",
    "5. For those representative products, call `calculate_margin` to estimate profitability.",
    `   ${vatNote}`,
    "",
    "Present your niche suggestions in a table showing:",
    "- Niche name (category or brand sub-segment)",
    "- SKU count in the niche",
    "- Average price range (min-max wholesale)",
    "- Stock health (what proportion are in stock)",
    "- EU coverage (what proportion are EU-shippable)",
    "- Representative product with its margin estimate",
    "",
    "Explain your reasoning for each niche recommendation.",
  ].join("\n");
}

export function registerNicheResearch(
  server: McpServer,
  _deps: PromptDeps,
): void {
  server.registerPrompt(
    "hw-niche-research",
    {
      title: "Niche Research",
      description: PROMPT_DESCRIPTIONS["hw-niche-research"],
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
