import { z } from "zod";

export const EvaluateProductInput = z.object({
  product_id: z.number().int().positive().describe("Hertwill product ID"),
  target_retail_price: z
    .number()
    .positive()
    .optional()
    .describe("Planned retail price in EUR"),
  ad_spend_per_unit: z
    .number()
    .nonnegative()
    .optional()
    .describe("Estimated ad spend per unit in EUR"),
  vat_rate: z
    .number()
    .min(0)
    .max(0.5)
    .optional()
    .describe("VAT rate as decimal (e.g. 0.21 for 21%)"),
});

export type EvaluateProductParams = z.infer<typeof EvaluateProductInput>;
