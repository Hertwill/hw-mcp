/** Structured price - CONTRACT-05 */
export interface McpPrice {
  amount: number;
  currency: "EUR";
}

/** Bucketed stock info - CONTRACT-06 */
export interface McpStockInfo {
  stock_level: "in_stock" | "low" | "out_of_stock";
  stock_checked_at: string; // ISO 8601
}

/** Pagination metadata for list envelopes - CONTRACT-08 */
export interface McpPagination {
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

/** Hints for agent next action - CONTRACT-08 */
export interface McpHints {
  next_step: string;
}

/** Generic list envelope - CONTRACT-08 */
export interface McpListEnvelope<T> {
  items: T[];
  pagination: McpPagination;
  hints: McpHints;
}

/** Transformed product for list responses */
export interface McpProductListItem {
  id: number;
  slug: string;
  name: string; // wrapped in untrusted delimiters
  description: string; // truncated + wrapped in untrusted delimiters
  sku: string;
  price: McpPrice;
  sale_price: McpPrice | null;
  stock: McpStockInfo;
  brand: { name: string; slug: string } | null;
  images: { featured: string | null; gallery: string[] };
  created_at: string;
}

/** Transformed variation for detail responses */
export interface McpVariation {
  id: number;
  name: string;
  sku: string;
  price: McpPrice;
  sale_price: McpPrice | null;
  stock: McpStockInfo;
  attributes: { name: string; value: string }[];
}

/** Transformed product for detail responses */
export interface McpProductDetail extends McpProductListItem {
  description: string; // full (NOT truncated) + wrapped in untrusted delimiters
  ships_to: string[]; // ISO country codes - CONTRACT-09
  category: { name: string; slug: string } | null;
  variations: McpVariation[];
}

/** Transformed import list item */
export interface McpImportListItem {
  id: number;
  product_id: number;
  name: string;
  price: McpPrice;
  sale_price: McpPrice | null;
  stock_status: string;
  sync_status: string;
  added_at: string | null;
}

/** Transformed sync job */
export interface McpSyncJob {
  product_id: number;
  name: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  has_errors: boolean;
}
