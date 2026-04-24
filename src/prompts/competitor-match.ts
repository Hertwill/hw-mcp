import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PROMPT_DESCRIPTIONS } from "./descriptions.js";
import {
  buildFilterNote,
  buildVatNote,
  DiscoveryOptionalArgs,
} from "./shared-args.js";
import type { PromptDeps } from "./types.js";

const CompetitorMatchArgs = {
  input: z
    .string()
    .describe("Competitor product URL, title, or description to match against"),
  ...DiscoveryOptionalArgs,
};

function buildInstructions(args: Record<string, string | undefined>): string {
  const input = args.input ?? "";
  const filterNote = buildFilterNote(args);
  const vatNote = buildVatNote(args.vat_rate);

  return [
    "You are running a Hertwill Competitor Match to find equivalent products in the Hertwill catalog.",
    "",
    `Competitor input: "${input}"`,
    filterNote,
    "",
    "Follow these steps:",
    "",
    `1. Analyze the competitor input above. Extract key product features, keywords, and category signals from: "${input}"`,
    "2. Call `search_products` with the extracted terms to leverage Hertwill's semantic search. Run 2-3 searches with different keyword combinations to maximize coverage.",
    "3. Apply any additional filters provided above.",
    "4. For the top matches, call `evaluate_product` to get factual scorecards (margin band, stock, EU shipping, variant count).",
    "5. For the best matches, call `calculate_margin` to compare margin potential against the competitor product.",
    `   ${vatNote}`,
    "6. Present a side-by-side comparison table showing:",
    "   - Competitor input vs each Hertwill match",
    "   - Price delta (how Hertwill's wholesale compares)",
    "   - EU shipping availability",
    "   - Stock status",
    "   - Margin potential at suggested retail",
    "   - Key similarities and differences",
    "",
    "Focus on factual comparisons. Do not speculate about the competitor's margin or sourcing strategy.",
  ].join("\n");
}

export function registerCompetitorMatch(
  server: McpServer,
  _deps: PromptDeps,
): void {
  server.registerPrompt(
    "hw-competitor-match",
    {
      title: "Competitor Match",
      description: PROMPT_DESCRIPTIONS["hw-competitor-match"],
      argsSchema: CompetitorMatchArgs,
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
