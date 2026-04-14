import { z } from "zod";

export const SyncProductsInput = z.object({
  product_id: z.number().int().positive().describe("Product ID to sync"),
  default_store_markup: z
    .number()
    .positive()
    .describe("Markup multiplier (e.g. 2.0 for 100% markup)"),
  currency: z.string().optional().describe("Target currency code"),
  lang: z.string().optional().describe("Target language code"),
});

export type SyncProductsParams = z.infer<typeof SyncProductsInput>;
