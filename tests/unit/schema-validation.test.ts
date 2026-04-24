import { describe, expect, it } from "vitest";
import { HertwillSchemaMismatchError } from "../../src/errors/schema-error.js";
import {
  PaginationMetaSchema,
  validateResponse,
} from "../../src/hertwill/schemas/common.js";
import {
  ProductListItemSchema,
  ProductDetailSchema,
  ProductListResponseSchema,
} from "../../src/hertwill/schemas/products.js";
import {
  CategorySchema,
  BrandSchema,
} from "../../src/hertwill/schemas/categories.js";
import { ImportListItemSchema } from "../../src/hertwill/schemas/import-list.js";
import { SyncJobSchema } from "../../src/hertwill/schemas/sync.js";
import {
  LoginResponseSchema,
  ApiKeySchema,
} from "../../src/hertwill/schemas/auth.js";

const validProductListItem = {
  id: 123,
  slug: "organic-cotton-tshirt",
  name: "Organic Cotton T-Shirt",
  description: "Premium organic cotton t-shirt",
  sku: "OCT-001",
  price: 29.99,
  sale_price: null,
  stock: 50,
  stock_status: "instock" as const,
  brand: {
    id: "5",
    name: "EcoWear",
    slug: "ecowear",
    description: "",
  },
  images: {
    featured: "https://cdn.hertwill.com/products/123.jpg",
    gallery: [],
  },
  category: { id: 1, name: "Apparel", slug: "apparel" },
  collections: [{ id: 10, name: "Summer 2026", slug: "summer-2026" }],
  created_at: "2026-04-07T12:00:00.000Z",
};

describe("ProductListItemSchema", () => {
  it("validates a correct product list item", () => {
    const result = ProductListItemSchema.safeParse(validProductListItem);
    expect(result.success).toBe(true);
  });

  it("rejects an item with missing name field", () => {
    const { name, ...withoutName } = validProductListItem;
    const result = ProductListItemSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });
});

describe("ProductDetailSchema", () => {
  it("validates a product with variations array", () => {
    const detail = {
      ...validProductListItem,
      variations: [
        {
          id: 1,
          name: "Size M",
          sku: "OCT-001-M",
          price: 29.99,
          sale_price: null,
          image: null,
          stock: 25,
          stock_status: "instock",
          attributes: [{ name: "Size", value: "M" }],
        },
      ],
    };
    const result = ProductDetailSchema.safeParse(detail);
    expect(result.success).toBe(true);
  });
});

describe("ProductListResponseSchema", () => {
  it("validates { data: [...], meta: { pagination, ... } }", () => {
    const response = {
      data: [validProductListItem],
      meta: {
        pagination: { page: 1, per_page: 50, total: 234, page_count: 5 },
        request_id: "550e8400-e29b-41d4-a716-446655440000",
      },
    };
    const result = ProductListResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });
});

describe("validateResponse", () => {
  it("with valid data returns parsed result", () => {
    const data = { page: 1, per_page: 50, total: 100, page_count: 2 };
    const parsed = validateResponse(
      PaginationMetaSchema,
      data,
      "/v1/products",
    );
    expect(parsed).toEqual(data);
  });

  it("with missing field throws HertwillSchemaMismatchError naming the field", () => {
    const data = { page: 1, per_page: 50 }; // missing total, page_count
    expect(() =>
      validateResponse(PaginationMetaSchema, data, "/v1/products"),
    ).toThrow(HertwillSchemaMismatchError);
  });

  it("HertwillSchemaMismatchError message contains upgrade @hertwill/mcp", () => {
    const data = { page: 1, per_page: 50 };
    try {
      validateResponse(PaginationMetaSchema, data, "/v1/products");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HertwillSchemaMismatchError);
      expect((err as HertwillSchemaMismatchError).message).toContain(
        "upgrade @hertwill/mcp",
      );
    }
  });

  it("unknown extra fields are silently stripped (strip mode per D-07)", () => {
    const data = {
      ...validProductListItem,
      unknown_future_field: "should be stripped",
      another_new_field: 42,
    };
    const result = ProductListItemSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("unknown_future_field");
      expect(result.data).not.toHaveProperty("another_new_field");
    }
  });
});

describe("CategorySchema", () => {
  it("validates a category object", () => {
    const category = {
      id: "1",
      slug: "apparel",
      name: "Apparel",
      parent_id: null,
      children: [
        { id: "2", slug: "t-shirts", name: "T-Shirts", parent_id: "1" },
      ],
    };
    const result = CategorySchema.safeParse(category);
    expect(result.success).toBe(true);
  });
});

describe("BrandSchema", () => {
  it("validates a brand object", () => {
    const brand = {
      id: "5",
      name: "EcoWear",
      slug: "ecowear",
      description: "Eco-friendly clothing brand",
      logo: "https://cdn.hertwill.com/brands/ecowear.png",
    };
    const result = BrandSchema.safeParse(brand);
    expect(result.success).toBe(true);
  });
});

describe("ImportListItemSchema", () => {
  it("validates an import list item", () => {
    const item = {
      id: 1001,
      product_id: 123,
      name: "Organic Cotton T-Shirt",
      sku: "OCT-001",
      price: 29.99,
      sale_price: null,
      stock_status: "instock",
      status: "not-synced",
      added_at: "2026-04-07T12:00:00.000Z",
    };
    const result = ImportListItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });
});

describe("SyncJobSchema", () => {
  it("validates a sync job object", () => {
    const job = {
      product_id: 123,
      name: "Organic Cotton T-Shirt",
      status: "synced",
      started_at: "2026-04-07T12:00:00.000Z",
      completed_at: "2026-04-07T12:01:00.000Z",
      has_errors: false,
    };
    const result = SyncJobSchema.safeParse(job);
    expect(result.success).toBe(true);
  });
});

describe("LoginResponseSchema", () => {
  it("validates a login response with JWT token", () => {
    const response = {
      data: {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example",
        refresh_token: "rt_abc123def456",
        user: { id: 1, email: "user@example.com" },
      },
    };
    const result = LoginResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });
});

describe("ApiKeySchema", () => {
  it("validates an API key object", () => {
    const apiKey = {
      id: 1,
      name: "My CLI Key",
      prefix: "hw_live_a1b2c3d4",
      key: "hw_live_FAKEKEY1",
      store_id: 42,
      created_at: "2026-04-07T12:00:00.000Z",
    };
    const result = ApiKeySchema.safeParse(apiKey);
    expect(result.success).toBe(true);
  });
});
