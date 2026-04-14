import type { z } from "zod";
import { ProductIdParam } from "./common.js";

export const GetProductInput = ProductIdParam;
export type GetProductParams = z.infer<typeof GetProductInput>;
