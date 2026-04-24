import { z } from "zod";

// Category child shape (no nested children)
const CategoryChildSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  parent_id: z.string().nullable().optional(),
});

// Category shape from OpenAPI: id is string
export const CategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  parent_id: z.string().nullable().optional(),
  children: z.array(CategoryChildSchema).optional(),
});

export type Category = z.infer<typeof CategorySchema>;

// Category list response: { data: Category[], meta?: { request_id? } }
export const CategoryListResponseSchema = z.object({
  data: z.array(CategorySchema),
  meta: z
    .object({
      request_id: z.string().optional(),
    })
    .optional(),
});

export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;

// Category detail response: { data: Category, meta?: { request_id? } }
export const CategoryDetailResponseSchema = z.object({
  data: CategorySchema,
  meta: z
    .object({
      request_id: z.string().optional(),
    })
    .optional(),
});

export type CategoryDetailResponse = z.infer<
  typeof CategoryDetailResponseSchema
>;

// Brand shape from OpenAPI: id is string
export const BrandSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
});

export type Brand = z.infer<typeof BrandSchema>;

// Brand list response: { data: Brand[], meta?: { request_id? } }
export const BrandListResponseSchema = z.object({
  data: z.array(BrandSchema),
  meta: z
    .object({
      request_id: z.string().optional(),
    })
    .optional(),
});

export type BrandListResponse = z.infer<typeof BrandListResponseSchema>;
