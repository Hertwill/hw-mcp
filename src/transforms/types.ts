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
  /** Your cost basis: the Hertwill API sets this equal to `price` (the list
   *  Wholesale Price, before any `sale_price`), never its internal COGS. */
  cost: McpPrice;
  stock_status: string;
  sync_status: string;
  added_at: string | null;
}

/** Transformed brand, including marketing material links. */
export interface McpBrand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** URL of the brand logo image. */
  logo: string | null;
  /** URL of the brand cover/banner image. */
  cover: string | null;
  /** Link to the brand's downloadable marketing materials (banners, promo
   *  images, product photography) for use in your store. */
  marketing_assets_url: string | null;
  /** ISO-2 country the brand ships from (use as `origin` for shipping rates). */
  shipping_origin_iso_code: string | null;
}

/** A single origin->destination shipping rate lane. */
export interface McpShippingPrice {
  origin_iso_code: string;
  dest_iso_code: string;
  /** Shipping price for this lane, or null when no rate is defined. */
  price: McpPrice | null;
  origin_country: string | null;
  destination_country: string | null;
}

/** A brand's shipping price list (coverage tag + per-lane rates). */
export interface McpShippingPriceList {
  id: number;
  /** Coverage tag, e.g. "EU", "EU · UK · USA". */
  name: string;
  description: string | null;
  /** True when the brand ships at least one product on this list per item. */
  per_item: boolean;
  shipping_prices: McpShippingPrice[];
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
