import type { ImportListItem } from "../hertwill/schemas/import-list.js";
import { transformNullablePrice, transformPrice } from "./product.js";
import type { McpImportListItem } from "./types.js";

/** Normalize a timestamp (string or Unix epoch number) to ISO-8601. */
function normalizeTs(ts: string | number | null | undefined): string | null {
  if (ts == null) return null;
  if (typeof ts === "number") return new Date(ts * 1000).toISOString();
  return ts;
}

/**
 * Transform a raw ImportListItem to MCP import-list shape.
 *
 * Handles both live-API shape (`dropship_id`, `sync_status`) and the
 * OpenAPI spec shape (`product_id`, `status`). Whichever is present wins;
 * if neither is set, `product_id` falls back to `id` so the response is
 * still useful for downstream operations like sync_products.
 */
export function transformImportListItem(
  item: ImportListItem,
): McpImportListItem {
  return {
    id: item.id,
    product_id: item.dropship_id ?? item.product_id ?? item.id,
    name: item.name,
    price: transformPrice(item.price),
    sale_price: transformNullablePrice(item.sale_price),
    // Cost basis == wholesale price. Fall back to `price` when the API version
    // predates the explicit `cost` field so the value is always populated.
    cost: transformPrice(item.cost ?? item.price),
    stock_status: item.stock_status ?? "unknown",
    sync_status: item.sync_status ?? item.status ?? "unknown",
    added_at: normalizeTs(item.added_at ?? item.created_at ?? null),
  };
}
