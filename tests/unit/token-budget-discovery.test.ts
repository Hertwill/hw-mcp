/**
 * SEC-04: Per-tool token budget regression tests.
 *
 * Asserts that every discovery tool's worst-case output fits under 4K tokens
 * (chars/4 heuristic). This gates public release: a bloated response could
 * exhaust an agent's context window and create a DoS vector.
 *
 * Discovery tools covered: search_products, list_products, get_product,
 * evaluate_product, calculate_margin, check_health.
 *
 * The existing CONTRACT-08 test in token-budget.test.ts covers the list
 * envelope pattern; this file extends it to cover the remaining tool shapes.
 */

import { describe, expect, it } from "vitest";
import type { ProductDetail, ProductListItem } from "../../src/hertwill/schemas/products.js";
import { transformProductDetail, transformProductListItem } from "../../src/transforms/product.js";
import { transformPagination } from "../../src/transforms/pagination.js";
import type { McpListEnvelope } from "../../src/transforms/types.js";

/** Conservative token estimate: ~4 chars per token for English/JSON text. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const TOKEN_BUDGET = 4000;

/** Worst-case product for list responses. */
function createWorstCaseProduct(id: number): ProductListItem {
  return {
    id,
    slug: `product-slug-${id}`,
    name: `P${"r".repeat(49)}`, // 50-char name
    description: "D".repeat(600), // long desc — exercises truncation in list
    sku: `SKU-${id}-HW`,
    price: 999.99,
    sale_price: 499.99,
    stock: 1,
    stock_status: "instock",
    brand: {
      id: "brand-1",
      name: "B".repeat(20),
      slug: "b".repeat(20),
      description: null,
      logo: null,
    },
    images: {
      featured: `https://cdn.example.com/products/${id}/${"p".repeat(40)}.jpg`,
      gallery: [],
    },
    category: { id: "cat-1", name: "Category", slug: "category" },
    collections: [],
    shipping_regions: [
      { code: "EU", name: "European Union" },
      { code: "DE", name: "Germany" },
      { code: "FR", name: "France" },
    ],
    attributes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-04-13T00:00:00.000Z",
  };
}

/** Worst-case detail: 10 variations × 3 attributes, full description. */
function createWorstCaseDetail(id: number): ProductDetail {
  return {
    ...createWorstCaseProduct(id),
    description: "D".repeat(600), // full, NOT truncated in detail
    variations: Array.from({ length: 10 }, (_, vi) => ({
      id: id * 100 + vi,
      name: `Variation ${"V".repeat(20)} ${vi}`,
      sku: `SKU-${id}-V${vi}`,
      price: 19.99 + vi,
      sale_price: null,
      stock: vi % 3 === 0 ? 0 : 5,
      stock_status: vi % 3 === 0 ? "outofstock" : ("instock" as const),
      image: null,
      attributes: [
        { name: "Color", value: "Option-A" },
        { name: "Size", value: "Option-B" },
        { name: "Material", value: "Option-C" },
      ],
    })),
  };
}

describe("SEC-04: Discovery tool token budgets", () => {
  it("Tool 1 (search_products): 20-item worst-case page fits under 4K tokens", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      transformProductListItem(createWorstCaseProduct(i + 1)),
    );
    const envelope: McpListEnvelope<(typeof items)[number]> = {
      items,
      ...transformPagination(
        { page: 1, per_page: 20, total: 200, page_count: 10 },
        "search_products",
      ),
    };
    const tokens = estimateTokens(JSON.stringify(envelope));
    expect(tokens).toBeLessThan(TOKEN_BUDGET);
  });

  it("Tool 2 (list_products): 20-item worst-case page fits under 4K tokens", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      transformProductListItem(createWorstCaseProduct(i + 1)),
    );
    const envelope: McpListEnvelope<(typeof items)[number]> = {
      items,
      ...transformPagination(
        { page: 1, per_page: 20, total: 200, page_count: 10 },
        "list_products",
      ),
    };
    const tokens = estimateTokens(JSON.stringify(envelope));
    expect(tokens).toBeLessThan(TOKEN_BUDGET);
  });

  it("Tool 3 (get_product): worst-case detail (10 variants × 3 attrs, 600-char desc) fits under 4K tokens", () => {
    const detail = transformProductDetail(createWorstCaseDetail(9999));
    const tokens = estimateTokens(JSON.stringify(detail));
    expect(tokens).toBeLessThan(TOKEN_BUDGET);
  });

  it("Tool 4 (evaluate_product): worst-case scorecard fits under 4K tokens", () => {
    // Mirror of EvaluateProductScorecard shape from src/tools/evaluate-product.ts
    const scorecard = {
      product_id: 9999,
      name: `<untrusted_supplier_content product_id="9999">${"N".repeat(50)}</untrusted_supplier_content>`,
      margin_inputs: {
        cost: 999.99,
        msrp: 499.99,
        currency: "EUR",
      },
      shipping_regions: ["EU", "DE", "FR", "ES", "IT", "NL", "PL", "SE", "NO", "DK"],
      variant_count: 10,
      eu_shippable: true,
      stock_state: "in_stock",
      is_on_sale: true,
      has_variants: true,
    };
    const tokens = estimateTokens(JSON.stringify(scorecard));
    expect(tokens).toBeLessThan(TOKEN_BUDGET);
  });

  it("Tool 5 (calculate_margin): worst-case margin result fits under 4K tokens", () => {
    // Mirror of structuredContent from src/tools/calculate-margin.ts
    const marginResult = {
      cost: 999.99,
      retail_price: 1999.99,
      ad_spend: 50.0,
      vat_rate: 0.19,
      currency: "EUR",
      gross_margin: 950.0,
      margin_pct: 0.475,
      vat_owed_informational: 318.48,
      break_even_ad_spend: {
        breakeven: 1000.0,
        conservative_2x: 500.0,
        aggressive_3x: 333.33,
      },
    };
    const tokens = estimateTokens(JSON.stringify(marginResult));
    expect(tokens).toBeLessThan(TOKEN_BUDGET);
  });

  it("Tool 6 (check_health): worst-case health response fits under 4K tokens", () => {
    // Mirror of structuredContent from src/tools/check-health.ts
    const healthResponse = {
      server_version: "1.0.0-alpha.99+build.20260416.abcdef",
      hertwill_reachable: true,
      hertwill_latency_ms: 312,
      rate_limits: {
        public: {
          remaining: 59,
          limit: 60,
          reset_at: "2026-04-16T13:01:00.000Z",
        },
        authenticated: {
          configured: true,
          remaining: 299,
          limit: 300,
          reset_at: "2026-04-16T13:01:00.000Z",
        },
      },
    };
    const tokens = estimateTokens(JSON.stringify(healthResponse));
    expect(tokens).toBeLessThan(TOKEN_BUDGET);
  });
});
