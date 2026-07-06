import type {
  Brand,
  ShippingPriceList,
} from "../hertwill/schemas/categories.js";
import { transformNullablePrice } from "./product.js";
import type { McpBrand, McpShippingPriceList } from "./types.js";

/** Transform a raw Brand into the MCP brand shape (with marketing links). */
export function transformBrand(brand: Brand): McpBrand {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    description: brand.description ?? null,
    logo: brand.logo ?? null,
    cover: brand.cover ?? null,
    marketing_assets_url: brand.marketing_assets_url ?? null,
  };
}

/** Transform a raw shipping price list into the MCP shape (prices structured). */
export function transformShippingPriceList(
  list: ShippingPriceList,
): McpShippingPriceList {
  return {
    id: list.id,
    name: list.name,
    description: list.description ?? null,
    per_item: list.per_item ?? false,
    shipping_prices: list.shipping_prices.map((p) => ({
      origin_iso_code: p.origin_iso_code,
      dest_iso_code: p.dest_iso_code,
      price: transformNullablePrice(p.price),
      origin_country: p.origin_country ?? null,
      destination_country: p.destination_country ?? null,
    })),
  };
}
