import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PROMPT_DESCRIPTIONS } from "./descriptions.js";
import type { PromptDeps } from "./types.js";

const ImportBatchArgs = {
  product_ids: z
    .string()
    .describe(
      "Comma-separated Hertwill product IDs to import (e.g. '123,456,789')",
    ),
};

function parseProductIds(raw: string): number[] | null {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const ids: number[] = [];
  for (const part of parts) {
    const n = Number.parseInt(part, 10);
    if (Number.isNaN(n) || n <= 0) return null;
    ids.push(n);
  }
  return ids.length > 0 ? ids : null;
}

function buildInstructions(ids: number[]): string {
  const idList = ids.join(", ");
  return [
    `You are running a Hertwill Batch Import for ${ids.length} product(s): ${idList}.`,
    "",
    "Follow these steps EXACTLY:",
    "",
    "## Step 1: Validate each product",
    "",
    `For each product ID (${idList}):`,
    "- Call `get_product` to fetch current details",
    "- Record: name, wholesale price, stock status, variant count",
    "- Flag any product that is out of stock or has low stock",
    "",
    "## Step 2: Present confirmation summary",
    "",
    "Show the user a summary table BEFORE importing:",
    "",
    "| # | Product ID | Name | Price | Stock | Warning |",
    "|---|-----------|------|-------|-------|---------|",
    "| (fill from step 1 results) |",
    "",
    "Include warnings for:",
    "- Out of stock products (CRITICAL)",
    "- Low stock products (WARNING)",
    "- Price changes since last check (INFO)",
    "",
    "## Step 3: Ask for explicit confirmation",
    "",
    "**IMPORTANT: You MUST ask the user to confirm before proceeding.**",
    "Ask: \"Do you want to import these products? Please confirm with yes or no.\"",
    "",
    "- If the user says YES/confirm/proceed: continue to Step 4",
    "- If the user says NO/cancel/stop: abort the import and report \"Import cancelled by user\"",
    "- Do NOT proceed without explicit user consent",
    "",
    "## Step 4: Import (only after confirmation)",
    "",
    `Call \`add_to_import_list\` with product_ids: [${idList}]`,
    "",
    "Report the result: how many products were successfully added, any failures.",
  ].join("\n");
}

export function registerImportBatch(server: McpServer, _deps: PromptDeps): void {
  server.registerPrompt(
    "hw-import-batch",
    {
      title: "Batch Import",
      description: PROMPT_DESCRIPTIONS["hw-import-batch"],
      argsSchema: ImportBatchArgs,
    },
    async (args) => {
      const ids = parseProductIds(args.product_ids);
      if (!ids) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Invalid product_ids "${args.product_ids}" -- provide comma-separated positive numbers (e.g. "123,456,789").`,
              },
            },
          ],
        };
      }

      if (ids.length > 50) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Too many product IDs (${ids.length}). Maximum is 50 per batch. Split into smaller batches.`,
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
              text: buildInstructions(ids),
            },
          },
        ],
      };
    },
  );
}
