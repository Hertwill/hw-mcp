import type { SyncJob } from "../hertwill/schemas/sync.js";
import type { McpSyncJob } from "./types.js";

/** Transform a raw SyncJob to MCP sync-job shape with defaulted nullable fields. */
export function transformSyncJob(job: SyncJob): McpSyncJob {
  return {
    product_id: job.product_id,
    name: job.name ?? null,
    status: job.status,
    started_at: job.started_at ?? null,
    completed_at: job.completed_at ?? null,
    has_errors: job.has_errors ?? false,
  };
}
