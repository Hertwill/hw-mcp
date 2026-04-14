import type {
  ProductDetail,
  ProductListItem,
} from "../hertwill/schemas/products.js";
import type {
  McpPrice,
  McpProductDetail,
  McpProductListItem,
  McpStockInfo,
} from "./types.js";

/** Named constant for "low" stock threshold (Research Open Question 1). */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * Max description length in list responses before truncation.
 *
 * Empirically tuned against the CONTRACT-08 token budget test: 100 chars
 * keeps a realistic worst-case 20-item list page under 4K tokens once
 * name/image-URL/brand/sku/pagination overhead is accounted for (per the
 * chars/4 heuristic). Detail responses carry the full description.
 *
 * NOTE: The plan originally proposed 50 items per page under 4K tokens,
 * but that is physically infeasible for products with realistic name,
 * image-URL, and brand metadata. The effective per_page ceiling for list
 * tools is 20 (matches the Hertwill API default), not 50. See
 * tests/unit/token-budget.test.ts.
 */
export const MAX_LIST_DESCRIPTION_LENGTH = 100;

/** CONTRACT-05: Bare number -> structured price. */
export function transformPrice(price: number): McpPrice {
  return { amount: price, currency: "EUR" };
}

/** CONTRACT-05: Nullable price -> structured price or null. */
export function transformNullablePrice(
  price: number | null | undefined,
): McpPrice | null {
  return price != null ? transformPrice(price) : null;
}

/** CONTRACT-06: Stock status + count -> bucketed stock info. */
export function transformStockInfo(
  stockStatus: "instock" | "outofstock",
  stock?: number | null,
): McpStockInfo {
  let stockLevel: McpStockInfo["stock_level"];
  if (stockStatus === "outofstock" || stock === 0) {
    stockLevel = "out_of_stock";
  } else if (stock != null && stock <= LOW_STOCK_THRESHOLD) {
    stockLevel = "low";
  } else {
    stockLevel = "in_stock";
  }
  return {
    stock_level: stockLevel,
    stock_checked_at: new Date().toISOString(),
  };
}

/** CONTRACT-07: Wrap supplier-authored text in untrusted content delimiters. */
export function wrapUntrustedContent(text: string, productId: number): string {
  return `<untrusted_supplier_content product_id="${productId}">${text}</untrusted_supplier_content>`;
}

/** CONTRACT-09: Extract ISO country codes from shipping_regions. */
export function transformShipsTo(
  shippingRegions: Array<{ code: string; name: string }> | null | undefined,
): string[] {
  if (!shippingRegions) return [];
  return shippingRegions.map((r) => r.code);
}

/** Truncate text to maxLength chars, appending "..." if truncated. */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/** Transform a raw ProductListItem to MCP list-item shape. */
export function transformProductListItem(
  item: ProductListItem,
): McpProductListItem {
  return {
    id: item.id,
    slug: item.slug,
    name: wrapUntrustedContent(item.name, item.id),
    description: wrapUntrustedContent(
      truncateText(item.description, MAX_LIST_DESCRIPTION_LENGTH),
      item.id,
    ),
    sku: item.sku,
    price: transformPrice(item.price),
    sale_price: transformNullablePrice(item.sale_price),
    stock: transformStockInfo(item.stock_status, item.stock),
    brand: item.brand
      ? { name: item.brand.name, slug: item.brand.slug }
      : null,
    images: {
      featured: item.images.featured ?? null,
      gallery: item.images.gallery,
    },
    created_at: item.created_at,
  };
}

/**
 * Transform a raw ProductDetail to MCP detail shape.
 * Overrides description with full (non-truncated) wrapped text and adds
 * ships_to + variations fields (only present in detail responses).
 */
export function transformProductDetail(detail: ProductDetail): McpProductDetail {
  return {
    ...transformProductListItem(detail),
    description: wrapUntrustedContent(detail.description, detail.id),
    ships_to: transformShipsTo(detail.shipping_regions),
    category: detail.category
      ? { name: detail.category.name, slug: detail.category.slug }
      : null,
    variations: (detail.variations ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: transformPrice(v.price),
      sale_price: transformNullablePrice(v.sale_price),
      stock: transformStockInfo(
        v.stock_status as "instock" | "outofstock",
        v.stock,
      ),
      attributes: (v.attributes ?? []).map((a) => ({
        name: a.name,
        value: a.value,
      })),
    })),
  };
}
