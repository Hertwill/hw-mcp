import { z } from "zod";
import { PaginationMetaSchema } from "./common.js";

// Brand shape: the OpenAPI spec says object, but the live search/list
// endpoints return a plain string (brand name). Accept both; the transform
// layer normalizes to {name, slug} — when only a string is supplied, slug is
// the string itself (clients may still match it for filtering).
const BrandObjectSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
});
const BrandSchema = z.union([BrandObjectSchema, z.string()]);

// Variation attribute shape from OpenAPI
const VariationAttributeSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  value: z.string(),
});

// Variation shape from OpenAPI spec
const VariationSchema = z.object({
  id: z.number(),
  name: z.string(),
  sku: z.string(),
  price: z.number(),
  sale_price: z.number().nullable().optional(),
  image: z.string().nullable().optional(),
  stock: z.number().nullable().optional(),
  stock_status: z.string(),
  attributes: z.array(VariationAttributeSchema).optional(),
});

// Image shape from OpenAPI
const ImagesSchema = z.object({
  featured: z.string().nullable().optional(),
  gallery: z.array(z.string()),
});

// Category inline shape
const CategoryInlineSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  slug: z.string(),
});

// Collection inline shape: spec says object, live API returns plain strings
// (collection names). Accept both.
const CollectionObjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});
const CollectionSchema = z.union([CollectionObjectSchema, z.string()]);

// Shipping region shape
const ShippingRegionSchema = z.object({
  code: z.string(),
  name: z.string(),
});

// Product list item -- variations NOT included in list responses per OpenAPI
export const ProductListItemSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  sku: z.string(),
  price: z.number(),
  sale_price: z.number().nullable().optional(),
  stock: z.number().nullable().optional(),
  stock_status: z.enum(["instock", "outofstock"]),
  brand: BrandSchema.nullable().optional(),
  images: ImagesSchema,
  category: CategoryInlineSchema.nullable().optional(),
  collections: z.array(CollectionSchema).optional(),
  shipping_regions: z.array(ShippingRegionSchema).nullable().optional(),
  attributes: z.array(z.object({})).nullable().optional(),
  // Live API returns either an ISO-8601 string or a Unix-epoch number.
  created_at: z.union([z.string(), z.number()]),
  updated_at: z.union([z.string(), z.number()]).nullable().optional(),
});

export type ProductListItem = z.infer<typeof ProductListItemSchema>;

// Product detail -- includes variations
export const ProductDetailSchema = ProductListItemSchema.extend({
  variations: z.array(VariationSchema).optional(),
});

export type ProductDetail = z.infer<typeof ProductDetailSchema>;

// List response envelope: { data: [...], meta: { pagination, facets?, request_id? } }
export const ProductListResponseSchema = z.object({
  data: z.array(ProductListItemSchema),
  meta: z.object({
    pagination: PaginationMetaSchema,
    facets: z.array(z.unknown()).optional(),
    request_id: z.string().optional(),
  }),
});

export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;

// Detail response envelope: { data: Product, meta?: { request_id? } }
export const ProductDetailResponseSchema = z.object({
  data: ProductDetailSchema,
  meta: z
    .object({
      request_id: z.string().optional(),
    })
    .optional(),
});

export type ProductDetailResponse = z.infer<typeof ProductDetailResponseSchema>;

// Search uses the same response shape as product list
export const ProductSearchResponseSchema = ProductListResponseSchema;
export type ProductSearchResponse = z.infer<typeof ProductSearchResponseSchema>;
