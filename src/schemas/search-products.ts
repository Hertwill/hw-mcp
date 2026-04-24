import { z } from "zod";
import { PaginationInput, PriceRangeFilter } from "./common.js";

export const SearchProductsInput = z.object({
  query: z
    .string()
    .min(1)
    .describe("Search query (keyword or natural language)"),
  ...PaginationInput.shape,
  ...PriceRangeFilter.shape,
  brand: z.string().optional().describe("Filter by brand slug"),
  category: z.string().optional().describe("Filter by category slug"),
  on_sale: z.boolean().optional().describe("Filter to on-sale products only"),
  stock_status: z
    .enum(["instock", "outofstock"])
    .optional()
    .describe("Filter by stock status"),
  shipping_region: z
    .string()
    .optional()
    .describe("Filter by shipping region (e.g. 'EU')"),
  sort_by: z.enum(["price", "date", "sales"]).optional().describe("Sort field"),
  sort_order: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
});

export type SearchProductsParams = z.infer<typeof SearchProductsInput>;
