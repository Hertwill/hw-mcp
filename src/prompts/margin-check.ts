import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PROMPT_DESCRIPTIONS } from "./descriptions.js";
import type { PromptDeps } from "./types.js";

const MarginCheckArgs = {
  product_id: z.string().describe("Hertwill product ID to check margin for"),
};

function buildInstructions(productId: number): string {
  return [
    `You are running a Hertwill Margin Check for product ID ${productId}.`,
    "",
    "Follow these steps:",
    "",
    `1. Call \`get_product\` with product ID ${productId} to retrieve full product details (name, wholesale price, stock status, variants, EU shipping).`,
    "2. Call `calculate_margin` with:",
    "   - cost: the product wholesale price from step 1",
    "   - retail_price: a suggested retail price (2x-3x markup on wholesale)",
    "   - ad_spend: estimated advertising cost per unit (e.g., 5 EUR)",
    "   - vat_rate: 0.20 (default 20% EU VAT)",
    "3. Present the results in a clear summary:",
    "   - Product name and wholesale price",
    "   - Suggested retail price and net margin percentage",
    "   - Break-even ad spend band (how much you can spend on ads before margin hits zero)",
    "   - Stock status and variant count",
    "   - Whether the product is EU-shippable",
    "4. Note that the VAT figure from `calculate_margin` is informational only -- actual VAT obligations depend on the seller's tax jurisdiction and registration.",
    "",
    "Show your reasoning so the user understands the margin calculation.",
  ].join("\n");
}

export function registerMarginCheck(
  server: McpServer,
  _deps: PromptDeps,
): void {
  server.registerPrompt(
    "hw-margin-check",
    {
      title: "Margin Check",
      description: PROMPT_DESCRIPTIONS["hw-margin-check"],
      argsSchema: MarginCheckArgs,
    },
    async (args) => {
      const id = Number.parseInt(args.product_id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Invalid product_id "${args.product_id}" -- must be a positive number.`,
              },
            },
          ],
        };
      }

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: buildInstructions(id),
            },
          },
        ],
      };
    },
  );
}
