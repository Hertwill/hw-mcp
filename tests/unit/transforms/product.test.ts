import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ProductDetail,
  ProductListItem,
} from "../../../src/hertwill/schemas/products.js";
import {
  MAX_LIST_DESCRIPTION_LENGTH,
  PRICING_WITHHELD_NOTE,
  pricingHint,
  transformNullablePrice,
  transformPrice,
  transformProductDetail,
  transformProductListItem,
  transformShipsTo,
  transformStockInfo,
  wrapUntrustedContent,
} from "../../../src/transforms/product.js";

const FIXED_NOW = new Date("2026-04-14T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("transformPrice (CONTRACT-05)", () => {
  it("converts a bare number to {amount, currency: EUR}", () => {
    expect(transformPrice(19.99)).toEqual({ amount: 19.99, currency: "EUR" });
  });

  it("handles zero", () => {
    expect(transformPrice(0)).toEqual({ amount: 0, currency: "EUR" });
  });

  it("transformNullablePrice returns null for null/undefined", () => {
    expect(transformNullablePrice(null)).toBeNull();
    expect(transformNullablePrice(undefined)).toBeNull();
  });

  it("transformNullablePrice wraps a number", () => {
    expect(transformNullablePrice(5)).toEqual({ amount: 5, currency: "EUR" });
  });
});

describe("pricingHint", () => {
  it("returns an empty hint when meta is absent (older API responses)", () => {
    expect(pricingHint(undefined)).toEqual({ note: "" });
    expect(pricingHint({})).toEqual({ note: "" });
  });

  it("returns an empty hint when pricing is included (authenticated caller)", () => {
    expect(pricingHint({ pricing: { included: true } })).toEqual({ note: "" });
  });

  it("surfaces the API message when pricing is withheld", () => {
    const result = pricingHint({
      pricing: { included: false, message: "Send an API key to see prices." },
    });
    expect(result.pricing).toEqual({
      included: false,
      message: "Send an API key to see prices.",
    });
    expect(result.note).toBe(" Send an API key to see prices.");
  });

  it("falls back to the default note when withheld with no message", () => {
    const result = pricingHint({ pricing: { included: false } });
    expect(result.pricing).toEqual({
      included: false,
      message: PRICING_WITHHELD_NOTE,
    });
    expect(result.note).toBe(` ${PRICING_WITHHELD_NOTE}`);
  });
});

describe("transformStockInfo (CONTRACT-06)", () => {
  it("returns in_stock for instock + high count", () => {
    expect(transformStockInfo("instock", 100)).toEqual({
      stock_level: "in_stock",
      stock_checked_at: FIXED_NOW.toISOString(),
    });
  });

  it("returns low for instock + small count (<= threshold)", () => {
    expect(transformStockInfo("instock", 3).stock_level).toBe("low");
  });

  it("returns out_of_stock for outofstock", () => {
    expect(transformStockInfo("outofstock", 0).stock_level).toBe(
      "out_of_stock",
    );
  });

  it("returns out_of_stock when stock is exactly 0 even with instock status", () => {
    expect(transformStockInfo("instock", 0).stock_level).toBe("out_of_stock");
  });

  it("returns in_stock for instock + null stock (unknown quantity defaults optimistic)", () => {
    expect(transformStockInfo("instock", null).stock_level).toBe("in_stock");
  });

  it("always stamps stock_checked_at with current ISO timestamp", () => {
    expect(transformStockInfo("instock", 50).stock_checked_at).toBe(
      FIXED_NOW.toISOString(),
    );
  });
});

describe("wrapUntrustedContent (CONTRACT-07)", () => {
  it("wraps text in delimiters with product_id attribution", () => {
    expect(wrapUntrustedContent("Great product", 42)).toBe(
      '<untrusted_supplier_content product_id="42">Great product</untrusted_supplier_content>',
    );
  });

  it("wraps empty string", () => {
    expect(wrapUntrustedContent("", 7)).toBe(
      '<untrusted_supplier_content product_id="7"></untrusted_supplier_content>',
    );
  });
});

describe("transformShipsTo (CONTRACT-09)", () => {
  it("extracts ISO country codes", () => {
    expect(
      transformShipsTo([
        { code: "DE", name: "Germany" },
        { code: "FR", name: "France" },
      ]),
    ).toEqual(["DE", "FR"]);
  });

  it("returns empty array for null", () => {
    expect(transformShipsTo(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(transformShipsTo(undefined)).toEqual([]);
  });

  it("returns empty array for empty shipping_regions", () => {
    expect(transformShipsTo([])).toEqual([]);
  });
});

function makeListItem(
  overrides: Partial<ProductListItem> = {},
): ProductListItem {
  return {
    id: 1,
    slug: "test-product",
    name: "Test Product",
    description: "Short description",
    sku: "SKU-1",
    price: 9.99,
    sale_price: null,
    stock: 10,
    stock_status: "instock",
    brand: {
      id: "brand-1",
      name: "Test Brand",
      slug: "test-brand",
      description: null,
      logo: null,
    },
    images: { featured: "https://example.com/f.jpg", gallery: [] },
    category: { id: "cat-1", name: "Cat", slug: "cat" },
    collections: [],
    shipping_regions: null,
    attributes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

describe("transformProductListItem", () => {
  it("truncates description to MAX_LIST_DESCRIPTION_LENGTH chars + ...", () => {
    const longDesc = "a".repeat(MAX_LIST_DESCRIPTION_LENGTH + 100);
    const out = transformProductListItem(
      makeListItem({ description: longDesc, id: 42 }),
    );
    // description is wrapped in delimiters, inner text truncated to MAX + "..."
    expect(out.description).toContain(
      `<untrusted_supplier_content product_id="42">`,
    );
    expect(out.description).toContain("...");
    const innerStart = out.description.indexOf(">") + 1;
    const innerEnd = out.description.lastIndexOf("<");
    const inner = out.description.slice(innerStart, innerEnd);
    expect(inner.length).toBe(MAX_LIST_DESCRIPTION_LENGTH + 3); // truncated + "..."
  });

  it("does not truncate descriptions shorter than the limit", () => {
    const out = transformProductListItem(
      makeListItem({ description: "Short desc", id: 1 }),
    );
    expect(out.description).toBe(
      '<untrusted_supplier_content product_id="1">Short desc</untrusted_supplier_content>',
    );
  });

  it("wraps name in untrusted delimiters", () => {
    const out = transformProductListItem(makeListItem({ id: 7, name: "Hi" }));
    expect(out.name).toBe(
      '<untrusted_supplier_content product_id="7">Hi</untrusted_supplier_content>',
    );
  });

  it("transforms price and sale_price to structured form", () => {
    const out = transformProductListItem(
      makeListItem({ price: 19.99, sale_price: 14.99 }),
    );
    expect(out.price).toEqual({ amount: 19.99, currency: "EUR" });
    expect(out.sale_price).toEqual({ amount: 14.99, currency: "EUR" });
  });
});

describe("transformProductDetail", () => {
  it("includes full (untruncated) description and ships_to array", () => {
    const longDesc = "a".repeat(MAX_LIST_DESCRIPTION_LENGTH + 100);
    const detail: ProductDetail = {
      ...makeListItem({ id: 42, description: longDesc }),
      shipping_regions: [
        { code: "DE", name: "Germany" },
        { code: "FR", name: "France" },
      ],
      variations: [],
    };
    const out = transformProductDetail(detail);
    expect(out.ships_to).toEqual(["DE", "FR"]);
    // Inner description matches the original (no "..." truncation marker at end)
    const innerStart = out.description.indexOf(">") + 1;
    const innerEnd = out.description.lastIndexOf("<");
    const inner = out.description.slice(innerStart, innerEnd);
    expect(inner).toBe(longDesc);
  });

  it("transforms variations with structured prices and bucketed stock", () => {
    const detail: ProductDetail = {
      ...makeListItem({ id: 1 }),
      variations: [
        {
          id: 101,
          name: "Red",
          sku: "V-R",
          price: 12.5,
          sale_price: 10,
          image: null,
          stock: 3,
          stock_status: "instock",
          attributes: [{ name: "Color", value: "Red" }],
        },
      ],
    };
    const out = transformProductDetail(detail);
    expect(out.variations).toHaveLength(1);
    expect(out.variations[0]?.price).toEqual({
      amount: 12.5,
      currency: "EUR",
    });
    expect(out.variations[0]?.stock.stock_level).toBe("low");
    expect(out.variations[0]?.attributes).toEqual([
      { name: "Color", value: "Red" },
    ]);
  });

  it("defaults variations to empty array when absent", () => {
    const detail: ProductDetail = {
      ...makeListItem({ id: 1 }),
    };
    const out = transformProductDetail(detail);
    expect(out.variations).toEqual([]);
  });

  it("defaults ships_to to empty array when shipping_regions is null", () => {
    const detail: ProductDetail = {
      ...makeListItem({ id: 1, shipping_regions: null }),
    };
    const out = transformProductDetail(detail);
    expect(out.ships_to).toEqual([]);
  });
});
