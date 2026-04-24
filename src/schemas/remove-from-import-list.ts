import type { z } from "zod";
import { ProductIdArrayParam } from "./common.js";

export const RemoveFromImportListInput = ProductIdArrayParam;
export type RemoveFromImportListParams = z.infer<
  typeof RemoveFromImportListInput
>;
