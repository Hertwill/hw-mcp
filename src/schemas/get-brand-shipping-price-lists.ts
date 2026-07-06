import { z } from "zod";

/** Input for get_brand_shipping_price_lists: brand ID + optional origin filter. */
export const GetBrandShippingPriceListsInput = z.object({
  brand_id: z.number().int().positive().describe("Hertwill brand ID"),
});

export type GetBrandShippingPriceListsParams = z.infer<
  typeof GetBrandShippingPriceListsInput
>;
