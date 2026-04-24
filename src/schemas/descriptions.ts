/**
 * Tool descriptions — concise registered strings for the MCP SDK's `registerTool()`.
 *
 * Source of truth: `docs/TOOLS.md` (per D-03). The CI test
 * `tests/unit/tool-descriptions.test.ts` asserts this map stays in sync with
 * that document (per D-04) and locks every description with golden-file
 * snapshots.
 *
 * Keep each description ~2-4 sentences: what it does, when to use, when NOT to
 * use (with sibling tool name), key return shape notes, and auth requirement.
 * Changing a string here requires regenerating the snapshot fixture.
 */

export const TOOL_NAMES = [
  "search_products",
  "list_products",
  "get_product",
  "evaluate_product",
  "calculate_margin",
  "check_health",
  "list_import_list",
  "add_to_import_list",
  "remove_from_import_list",
  "sync_products",
  "get_sync_jobs",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/** Human-readable titles for the connector directory listing. */
export const TOOL_TITLES: Record<ToolName, string> = {
  search_products: "Search Products",
  list_products: "Browse Products",
  get_product: "Get Product Details",
  evaluate_product: "Evaluate Product Viability",
  calculate_margin: "Calculate Margin",
  check_health: "Check Server Health",
  list_import_list: "View Import List",
  add_to_import_list: "Add to Import List",
  remove_from_import_list: "Remove from Import List",
  sync_products: "Sync Product to Store",
  get_sync_jobs: "View Sync Jobs",
};

/** MCP tool annotations for connector review compliance. */
export const TOOL_ANNOTATIONS: Record<
  ToolName,
  { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean }
> = {
  search_products: { readOnlyHint: true },
  list_products: { readOnlyHint: true },
  get_product: { readOnlyHint: true },
  evaluate_product: { readOnlyHint: true },
  calculate_margin: { readOnlyHint: true },
  check_health: { readOnlyHint: true },
  list_import_list: { readOnlyHint: true },
  add_to_import_list: { destructiveHint: false, idempotentHint: true },
  remove_from_import_list: { destructiveHint: true },
  sync_products: { destructiveHint: false, idempotentHint: false },
  get_sync_jobs: { readOnlyHint: true },
};

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  search_products: `Hybrid keyword + semantic search over the Hertwill catalog. Use when the user expresses intent with words or a natural-language query. Do NOT use for filter-only browsing (use list_products) or single-product detail (use get_product). Returns a paginated envelope with items carrying structured price {amount, currency} and bucketed stock; ships_to is not in list items — call get_product for shipping detail. Supplier text is wrapped in <untrusted_supplier_content>. No auth required.`,

  list_products: `Browse and filter the Hertwill catalog without a search query (category, brand, price range, stock status, shipping region). Use for filter-driven enumeration. Do NOT use when the request has keywords or natural-language intent (use search_products), or when the user wants one product's detail (use get_product). Returns a paginated envelope with structured prices and bucketed stock; ships_to is absent from list items — use get_product for shipping. No auth required.`,

  get_product: `Return full detail for a single Hertwill product by ID, including variations and shipping coverage (ships_to as ISO country codes). Use when you already have a product ID and need variants or shipping detail. Do NOT use to search (use search_products), browse (use list_products), or score viability (use evaluate_product). Supplier text is wrapped in <untrusted_supplier_content>. No auth required.`,

  evaluate_product: `Produce a factual structured viability scorecard for one product — margin inputs, shipping coverage, variant spread, and stock signal. Use when the user wants a comparable decision summary. Do NOT use when the user only wants product details (use get_product), pure margin math (use calculate_margin), or to find candidates first (use search_products). No auth required.`,

  calculate_margin: `Pure math utility: given cost, retail, ad spend, and VAT rate, return margin amount, margin %, and break-even ad-spend band. Makes zero API calls. Do NOT use when the user wants a real product evaluation (use evaluate_product) or to find products (use search_products). No auth required.`,

  check_health: `Report server version, Hertwill API reachability, and remaining rate-limit budget for both the public (60/min) and authenticated (300/min) buckets. Use for connectivity and capacity diagnostics. Do NOT use to search products (use search_products). No auth required.`,

  list_import_list: `Return the authenticated store's current Hertwill import list, paginated. Use to audit what's staged for sync. Do NOT use to search the catalog (use search_products), stage new products (use add_to_import_list), or check sync status (use get_sync_jobs). Returns a paginated envelope; ships_to is not in list items — use get_product for shipping. Requires HERTWILL_API_KEY.`,

  add_to_import_list: `Stage 1-50 Hertwill products into the authenticated store's import list in a single batch. Pass up to 50 product IDs in a single call. Do NOT call this tool in a loop for individual products. Do NOT use before the user has chosen products (use search_products or list_products) or to push staged products to the store (use sync_products). Returns {added, skipped, import_list_size}. Requires HERTWILL_API_KEY.`,

  remove_from_import_list: `Remove 1-50 products from the authenticated store's import list in a single batch call. Pass IDs in one call rather than looping. Do NOT use to view the current list (use list_import_list) or to add items (use add_to_import_list). Returns {removed, skipped, import_list_size}. Requires HERTWILL_API_KEY.`,

  sync_products: `Trigger a Shopify or WooCommerce sync for one product already staged in the import list, with a specified markup. Use to push a single staged product to the connected store. Do NOT use to check sync progress (use get_sync_jobs); if the product isn't yet staged, call add_to_import_list first. Returns {sync_job_id, product_id, status: "queued", markup_applied}. Requires HERTWILL_API_KEY.`,

  get_sync_jobs: `Return paginated sync job status for the authenticated store. Use to poll or review previously triggered syncs. Do NOT use to trigger a new sync (use sync_products) or to inspect the import list (use list_import_list). Returns a paginated envelope of {sync_job_id, product_id, status, created_at, finished_at, error}. Requires HERTWILL_API_KEY.`,
};
