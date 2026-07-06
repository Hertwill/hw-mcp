import { z } from "zod";
import { PaginationMetaSchema } from "./common.js";

// Import list item -- represents a product in the user's import list.
// Live API uses `dropship_id` (source product) and `sync_status`; the
// OpenAPI-derived names `product_id` / `status` appear in spec-compliant
// responses. Accept both shapes — the transform layer picks whichever is
// present.
export const ImportListItemSchema = z.object({
  id: z.number(),
  dropship_id: z.number().optional(),
  product_id: z.number().optional(),
  name: z.string(),
  sku: z.string().optional(),
  price: z.number(),
  sale_price: z.number().nullable().optional(),
  // Merchant cost basis = the Hertwill Wholesale Price (equals `price`).
  // Optional so responses from an API version predating the field still parse.
  cost: z.number().nullable().optional(),
  stock_status: z.string().optional(),
  sync_status: z.string().optional(),
  status: z.string().optional(),
  images: z
    .object({
      featured: z.string().nullable().optional(),
      gallery: z.array(z.string()).optional(),
    })
    .optional(),
  added_at: z.union([z.string(), z.number()]).optional(),
  created_at: z.union([z.string(), z.number()]).optional(),
  updated_at: z.union([z.string(), z.number()]).nullable().optional(),
});

export type ImportListItem = z.infer<typeof ImportListItemSchema>;

// Import list response: { data: ImportListItem[], meta: { pagination } }
export const ImportListResponseSchema = z.object({
  data: z.array(ImportListItemSchema),
  meta: z
    .object({
      pagination: PaginationMetaSchema.optional(),
      request_id: z.string().optional(),
    })
    .optional(),
});

export type ImportListResponse = z.infer<typeof ImportListResponseSchema>;

// Add to import list response item
const AddToImportListItemSchema = z.object({
  product_id: z.number(),
  status: z.enum(["added", "already_exists", "not_found", "error"]),
  parent_id: z.number().optional(),
  variation_ids: z.array(z.number()).optional(),
});

// Add to import list response: { data: [...] }
export const AddToImportListResponseSchema = z.object({
  data: z.array(AddToImportListItemSchema),
});

export type AddToImportListResponse = z.infer<
  typeof AddToImportListResponseSchema
>;
