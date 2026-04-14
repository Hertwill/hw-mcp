import { z } from "zod";

export const CheckAuthInput = z.object({});
export type CheckAuthParams = z.infer<typeof CheckAuthInput>;
