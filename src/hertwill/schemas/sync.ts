import { z } from "zod";
import { PaginationMetaSchema } from "./common.js";

// Sync job shape from OpenAPI: /v1/sync/jobs/{productId}
export const SyncJobSchema = z.object({
  product_id: z.number(),
  name: z.string().optional(),
  status: z.string(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  has_errors: z.boolean().optional(),
});

export type SyncJob = z.infer<typeof SyncJobSchema>;

// Sync job detail response: { data: SyncJob }
export const SyncJobDetailResponseSchema = z.object({
  data: SyncJobSchema,
});

export type SyncJobDetailResponse = z.infer<typeof SyncJobDetailResponseSchema>;

// Sync jobs list response: { data: SyncJob[], meta?: { pagination? } }
export const SyncJobsResponseSchema = z.object({
  data: z.array(SyncJobSchema),
  meta: z
    .object({
      pagination: PaginationMetaSchema.optional(),
      request_id: z.string().optional(),
    })
    .optional(),
});

export type SyncJobsResponse = z.infer<typeof SyncJobsResponseSchema>;

// Sync product response from POST /v1/sync/products
export const SyncProductResponseSchema = z.object({
  data: z.object({
    product_id: z.number(),
    status: z.string(),
    message: z.string().optional(),
  }),
});

export type SyncProductResponse = z.infer<typeof SyncProductResponseSchema>;
