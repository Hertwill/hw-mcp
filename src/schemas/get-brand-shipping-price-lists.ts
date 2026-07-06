import { z } from "zod";

/** Input for get_brand_shipping_price_lists: brand ID + optional origin filter. */
export const GetBrandShippingPriceListsInput = z.object({
  brand_id: z.number().int().positive().describe("Hertwill brand ID"),
  origin: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "origin must be a 2-letter ISO country code")
    .optional()
    .describe(
      "Optional ISO-2 origin country code to filter lanes to a single shipping origin",
    ),
});

export type GetBrandShippingPriceListsParams = z.infer<
  typeof GetBrandShippingPriceListsInput
>;
