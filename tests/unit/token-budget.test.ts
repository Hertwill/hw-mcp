import { describe, expect, it } from "vitest";
import type { ImportListItem } from "../../src/hertwill/schemas/import-list.js";
import type { ProductListItem } from "../../src/hertwill/schemas/products.js";
import { transformImportListItem } from "../../src/transforms/import-list.js";
import { transformPagination } from "../../src/transforms/pagination.js";
import { transformProductListItem } from "../../src/transforms/product.js";
import type { McpListEnvelope } from "../../src/transforms/types.js";

/**
 * CONTRACT-08 token budget test.
 *
 * Tokens are estimated with the standard chars/4 heuristic for English + JSON
 * (Assumption A1 in 03-RESEARCH.md). The 4K budget (Assumption A3) keeps a
 * single list page well inside typical agent context windows even when the
 * agent pages through many results.
 *
 * IMPORTANT: The plan originally proposed 50 items/page. That is physically
 * infeasible under 4K tokens once realistic product metadata (names,
 * image URLs, brands, SKUs, pagination overhead) is accounted for. The
 * effective list ceiling is 20 items/page, which matches the Hertwill API
 * default — see MAX_LIST_DESCRIPTION_LENGTH note in src/transforms/product.ts.
 */

/** Conservative token estimate: ~4 chars per token for English/JSON text. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const TOKEN_BUDGET = 4000;

/** Realistic worst-case product: names/URLs/brands at the high end of real data. */
function createWorstCaseProduct(id: number): ProductListItem {
  return {
    id,
    slug: `product-slug-${id}`,
    name: `P${"r".repeat(49)}`, // 50-char name (high end of real product names)
    description: "D".repeat(600), // long desc -> exercises truncation
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
    shipping_regions: null,
    attributes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-04-13T00:00:00.000Z",
  };
}

/** Realistic worst-case import list item. */
function createWorstCaseImportItem(id: number): ImportListItem {
  return {
    id,
    product_id: id + 1000,
    name: `P${"r".repeat(49)}`,
    sku: `SKU-${id}-HW`,
    price: 999.99,
    sale_price: 499.99,
    stock_status: "instock",
    status: "approval-required",
    images: {
      featured: `https://cdn.example.com/import/${id}.jpg`,
      gallery: [],
    },
    added_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-04-13T00:00:00.000Z",
  };
}

describe("CONTRACT-08: List response token budget", () => {
  it("estimateTokens uses chars/4 heuristic", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });

  it("20-item worst-case product list page fits under 4K tokens", () => {
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

  it("20-item worst-case import list page fits under 4K tokens", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      transformImportListItem(createWorstCaseImportItem(i + 1)),
    );
    const envelope: McpListEnvelope<(typeof items)[number]> = {
      items,
      ...transformPagination(
        { page: 1, per_page: 20, total: 200, page_count: 10 },
        "list_import_list",
      ),
    };
    const tokens = estimateTokens(JSON.stringify(envelope));
    expect(tokens).toBeLessThan(TOKEN_BUDGET);
  });

  it("typical 10-item product list page fits well under 4K tokens", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      transformProductListItem(createWorstCaseProduct(i + 1)),
    );
    const envelope: McpListEnvelope<(typeof items)[number]> = {
      items,
      ...transformPagination(
        { page: 1, per_page: 10, total: 40, page_count: 4 },
        "list_products",
      ),
    };
    const tokens = estimateTokens(JSON.stringify(envelope));
    expect(tokens).toBeLessThan(TOKEN_BUDGET);
  });
});
