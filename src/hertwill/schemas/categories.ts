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

// Brand shape from OpenAPI: id is string. Includes marketing material links
// (logo, cover, marketing_assets_url) and the brand's shipping origin country.
export const BrandSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  cover: z.string().nullable().optional(),
  marketing_assets_url: z.string().nullable().optional(),
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

// Brand detail response: { data: Brand, meta?: { request_id? } }
export const BrandDetailResponseSchema = z.object({
  data: BrandSchema,
  meta: z
    .object({
      request_id: z.string().optional(),
    })
    .optional(),
});

export type BrandDetailResponse = z.infer<typeof BrandDetailResponseSchema>;

// A single origin->destination shipping rate lane. `price` is null when no
// rate is defined for that destination. Country names are convenience labels.
export const ShippingPriceSchema = z.object({
  id: z.number().nullable().optional(),
  origin_iso_code: z.string(),
  dest_iso_code: z.string(),
  price: z.number().nullable(),
  origin_country: z.string().optional(),
  destination_country: z.string().optional(),
});

export type ShippingPrice = z.infer<typeof ShippingPriceSchema>;

// A brand's shipping price list. `name` is a coverage tag (e.g. "EU").
export const ShippingPriceListSchema = z.object({
  id: z.number(),
  name: z.string(),
  per_item: z.boolean().optional(),
  shipping_prices: z.array(ShippingPriceSchema),
});

export type ShippingPriceList = z.infer<typeof ShippingPriceListSchema>;

// Brand shipping price-lists response: { data: ShippingPriceList[], meta? }
export const BrandShippingPriceListsResponseSchema = z.object({
  data: z.array(ShippingPriceListSchema),
  meta: z
    .object({
      request_id: z.string().optional(),
    })
    .optional(),
});

export type BrandShippingPriceListsResponse = z.infer<
  typeof BrandShippingPriceListsResponseSchema
>;
