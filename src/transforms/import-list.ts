import type { ImportListItem } from "../hertwill/schemas/import-list.js";
import { transformNullablePrice, transformPrice } from "./product.js";
import type { McpImportListItem } from "./types.js";

/** Transform a raw ImportListItem to MCP import-list shape. */
export function transformImportListItem(
  item: ImportListItem,
): McpImportListItem {
  return {
    id: item.id,
    product_id: item.product_id,
    name: item.name,
    price: transformPrice(item.price),
    sale_price: transformNullablePrice(item.sale_price),
    stock_status: item.stock_status ?? "unknown",
    sync_status: item.status,
    added_at: item.added_at ?? item.created_at ?? null,
  };
}
