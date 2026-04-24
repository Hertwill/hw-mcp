import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PROMPT_DESCRIPTIONS } from "./descriptions.js";
import {
  buildFilterNote,
  buildVatNote,
  DiscoveryOptionalArgs,
} from "./shared-args.js";
import type { PromptDeps } from "./types.js";

const SeasonalPicksArgs = {
  season: z
    .string()
    .describe(
      "Target season or event (e.g., 'Q4 gifts', 'summer', 'back-to-school')",
    ),
  ...DiscoveryOptionalArgs,
};

function buildInstructions(args: Record<string, string | undefined>): string {
  const season = args.season ?? "general";
  const filterNote = buildFilterNote(args);
  const vatNote = buildVatNote(args.vat_rate);

  return [
    `You are running a Hertwill Seasonal Picks scan for: "${season}".`,
    "",
    `Find products that match the "${season}" theme.`,
    filterNote,
    "",
    "Follow these steps:",
    "",
    `1. Call \`search_products\` with keywords derived from the season "${season}". Think about what products people buy for this season or event (e.g., "Q4 gifts" -> gift items, holiday accessories, stocking stuffers; "summer" -> outdoor, beach, travel gear).`,
    "   Run 2-3 searches with different seasonal keyword variations to cast a wide net.",
    "2. Apply any additional filters provided above.",
    "3. For the top 10 results, call `evaluate_product` on each to check stock levels and EU shipping coverage.",
    "4. For products that look promising, call `calculate_margin` with the product cost, a reasonable seasonal retail markup, estimated ad spend, and VAT rate.",
    `   ${vatNote}`,
    "5. Rank products by a combination of margin potential and seasonal relevance.",
    "6. Present a shortlist of the top 5 seasonal picks in a table showing: product name, wholesale price, suggested retail, margin %, stock status, EU-shippable (yes/no), and why it fits the season.",
    "",
    "Show your reasoning at each step so the user can follow your sourcing logic.",
  ].join("\n");
}

export function registerSeasonalPicks(
  server: McpServer,
  _deps: PromptDeps,
): void {
  server.registerPrompt(
    "hw-seasonal-picks",
    {
      title: "Seasonal Picks",
      description: PROMPT_DESCRIPTIONS["hw-seasonal-picks"],
      argsSchema: SeasonalPicksArgs,
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
