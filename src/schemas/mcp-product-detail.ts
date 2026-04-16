import { z } from "zod";

/**
 * Zod v4 mirror of the Phase-3 McpProductDetail TypeScript interface
 * (src/transforms/types.ts). This is the single source of truth for RES-03:
 * the prebuild script runs z.toJSONSchema(McpProductDetailSchema) to emit
 * docs/resources/product.schema.json.
 *
 * IMPORTANT: Only use JSON-representable Zod primitives here.
 * Do NOT use z.date(), z.function(), z.symbol(), or z.promise() —
 * they produce broken or nonsensical JSON Schema output (RESEARCH Pitfall 2).
 */

export const McpPriceSchema = z.object({
  amount: z.number(),
  currency: z.literal("EUR"),
});

export const McpStockInfoSchema = z.object({
  stock_level: z.enum(["in_stock", "low", "out_of_stock"]),
  stock_checked_at: z.string(), // ISO 8601 string
});

export const McpVariationSchema = z.object({
  id: z.number(),
  name: z.string(),
  sku: z.string(),
  price: McpPriceSchema,
  sale_price: McpPriceSchema.nullable(),
  stock: McpStockInfoSchema,
  attributes: z.array(z.object({ name: z.string(), value: z.string() })),
});

export const McpProductDetailSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  sku: z.string(),
  price: McpPriceSchema,
  sale_price: McpPriceSchema.nullable(),
  stock: McpStockInfoSchema,
  brand: z.object({ name: z.string(), slug: z.string() }).nullable(),
  images: z.object({
    featured: z.string().nullable(),
    gallery: z.array(z.string()),
  }),
  created_at: z.string(),
  ships_to: z.array(z.string()),
  category: z.object({ name: z.string(), slug: z.string() }).nullable(),
  variations: z.array(McpVariationSchema),
});

export type McpProductDetailFromSchema = z.infer<
  typeof McpProductDetailSchema
>;
