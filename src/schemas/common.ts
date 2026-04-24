import { z } from "zod";

/** Shared pagination input for all list/search tools */
export const PaginationInput = z.object({
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Page number (1-based)"),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Items per page (max 50)"),
});

/** Shared price range filter for product search/list tools */
export const PriceRangeFilter = z.object({
  min_price: z
    .number()
    .nonnegative()
    .optional()
    .describe("Minimum price in EUR"),
  max_price: z
    .number()
    .nonnegative()
    .optional()
    .describe("Maximum price in EUR"),
});

/** Shared product ID parameter */
export const ProductIdParam = z.object({
  product_id: z.number().int().positive().describe("Hertwill product ID"),
});

/** Shared product ID array for batch operations */
export const ProductIdArrayParam = z.object({
  product_ids: z
    .array(z.number().int().positive())
    .min(1)
    .max(50)
    .describe("Array of Hertwill product IDs (1-50)"),
});
