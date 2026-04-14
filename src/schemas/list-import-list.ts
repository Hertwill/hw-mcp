import { z } from "zod";
import { PaginationInput } from "./common.js";

export const ListImportListInput = z.object({
  ...PaginationInput.shape,
  status: z
    .enum([
      "not-synced",
      "syncing",
      "synced",
      "sync-failed",
      "approved",
      "rejected",
      "pending",
      "approval-required",
    ])
    .optional()
    .describe("Filter by sync status"),
  order_by: z
    .enum(["added_dt", "name", "price"])
    .optional()
    .describe("Sort field"),
  order: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
});

export type ListImportListParams = z.infer<typeof ListImportListInput>;
