import { z } from "zod";

export const CalculateMarginInput = z.object({
  cost: z.number().positive().describe("Product cost in EUR"),
  retail_price: z.number().positive().describe("Retail price in EUR"),
  ad_spend: z
    .number()
    .nonnegative()
    .optional()
    .default(0)
    .describe("Ad spend per unit in EUR"),
  vat_rate: z
    .number()
    .min(0)
    .max(0.5)
    .optional()
    .default(0)
    .describe("VAT rate as decimal"),
});

export type CalculateMarginParams = z.infer<typeof CalculateMarginInput>;
