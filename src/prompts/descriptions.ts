/**
 * User-facing descriptions for all 8 Hertwill MCP prompts.
 *
 * These are shown in the MCP client's prompt list (slash commands).
 * Unlike tool descriptions (optimised for agent routing), prompt
 * descriptions are written for the human user who selects them.
 */
export const PROMPT_DESCRIPTIONS: Record<string, string> = {
  "hw-winner-scan":
    "Find winning Hertwill products with high margin potential. Searches the catalog, evaluates top candidates, and calculates margins to produce a ranked shortlist.",
  "hw-niche-research":
    "Research profitable niches in the Hertwill catalog. Analyzes categories, brands, and SKU counts to suggest sub-niches worth exploring.",
  "hw-eu-winners":
    "Find winning EU-shippable products. Pre-filtered for European fulfillment with VAT-aware margin calculations.",
  "hw-seasonal-picks":
    "Source products for an upcoming season or event. Finds themed products and evaluates margin potential.",
  "hw-competitor-match":
    "Find Hertwill equivalents to a competitor product. Uses semantic search to surface matching products with factual comparisons.",
  "hw-margin-check":
    "Check margin and break-even for a specific product by ID.",
  "hw-import-batch":
    "Batch import products to your store. Validates stock and price, shows a confirmation summary, then imports.",
  "hw-store-health":
    "Run a full diagnostic on your Hertwill store connection, rate limits, import list, and sync status.",
};
