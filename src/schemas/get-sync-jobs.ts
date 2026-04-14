import { z } from "zod";
import { PaginationInput } from "./common.js";

export const GetSyncJobsInput = z.object({
  ...PaginationInput.shape,
  status: z
    .enum(["syncing", "synced", "sync-failed", "not-synced"])
    .optional()
    .describe("Filter by job status"),
});

export type GetSyncJobsParams = z.infer<typeof GetSyncJobsInput>;
