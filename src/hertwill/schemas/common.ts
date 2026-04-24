import { z } from "zod";
import { HertwillSchemaMismatchError } from "../../errors/schema-error.js";

// Pagination shape from OpenAPI spec: page, per_page, total, page_count
export const PaginationMetaSchema = z.object({
  page: z.number(),
  per_page: z.number(),
  total: z.number(),
  page_count: z.number(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

// Error envelope from OpenAPI spec
export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: z
    .object({
      request_id: z.string(),
    })
    .optional(),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

/**
 * Validate an API response against a Zod schema.
 * Throws HertwillSchemaMismatchError with field names on validation failure.
 */
export function validateResponse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  endpoint: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fieldNames = result.error.issues
      .map((i) => i.path.join("."))
      .join(", ");
    throw new HertwillSchemaMismatchError(
      endpoint,
      fieldNames,
      result.error.issues,
    );
  }
  return result.data;
}
