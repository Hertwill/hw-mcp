import type { z } from "zod";
import { ProductIdArrayParam } from "./common.js";

export const AddToImportListInput = ProductIdArrayParam;
export type AddToImportListParams = z.infer<typeof AddToImportListInput>;
