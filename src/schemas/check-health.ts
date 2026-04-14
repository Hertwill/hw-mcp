import { z } from "zod";

export const CheckHealthInput = z.object({});
export type CheckHealthParams = z.infer<typeof CheckHealthInput>;
