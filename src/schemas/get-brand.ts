import { z } from "zod";

/** Input for get_brand: a single numeric brand ID. */
export const GetBrandInput = z.object({
  brand_id: z.number().int().positive().describe("Hertwill brand ID"),
});

export type GetBrandParams = z.infer<typeof GetBrandInput>;
