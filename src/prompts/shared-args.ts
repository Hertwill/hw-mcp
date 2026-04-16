import { z } from "zod";

/**
 * Optional arguments shared across all 5 discovery prompts.
 *
 * CRITICAL: All prompt args MUST be z.string() -- the MCP protocol
 * sends prompt arguments as strings at the wire level. Parse to
 * numbers in the callback if needed.
 */
export const DiscoveryOptionalArgs = {
  budget_max: z
    .string()
    .optional()
    .describe("Maximum product price in EUR (e.g., '30')"),
  vat_rate: z
    .string()
    .optional()
    .describe("VAT rate as decimal (e.g., '0.20' for 20%)"),
  category: z.string().optional().describe("Filter by product category"),
  brand: z.string().optional().describe("Filter by brand name"),
  per_page: z
    .string()
    .optional()
    .describe("Results per search page (default 20, max 20)"),
};

/**
 * Build a filter instruction string from optional discovery args.
 */
export function buildFilterNote(
  args: Record<string, string | undefined>,
): string {
  const filters: string[] = [];
  if (args.budget_max) filters.push(`max price: EUR ${args.budget_max}`);
  if (args.category) filters.push(`category: ${args.category}`);
  if (args.brand) filters.push(`brand: ${args.brand}`);
  if (args.per_page) filters.push(`per_page: ${args.per_page}`);

  return filters.length > 0
    ? `Apply these filters: ${filters.join(", ")}.`
    : "Search broadly across the catalog.";
}

/**
 * Build a VAT note from optional vat_rate arg.
 */
export function buildVatNote(vatRate: string | undefined): string {
  return vatRate
    ? `Use VAT rate ${vatRate} for margin calculations.`
    : "Use a default VAT rate of 0.20 (20%) for margin calculations unless the user specifies otherwise.";
}
