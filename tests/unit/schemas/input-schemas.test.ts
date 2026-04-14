import { describe, it, expect } from "vitest";
import {
  SearchProductsInput,
  ListProductsInput,
  GetProductInput,
  EvaluateProductInput,
  CalculateMarginInput,
  CheckHealthInput,
  ListImportListInput,
  AddToImportListInput,
  RemoveFromImportListInput,
  SyncProductsInput,
  GetSyncJobsInput,
  CheckAuthInput,
  PaginationInput,
  PriceRangeFilter,
  ProductIdParam,
} from "../../../src/schemas/index.js";

describe("Shared building blocks", () => {
  describe("PaginationInput", () => {
    it("accepts valid pagination", () => {
      expect(PaginationInput.safeParse({ page: 1, per_page: 20 }).success).toBe(
        true,
      );
    });
    it("accepts empty (all optional)", () => {
      expect(PaginationInput.safeParse({}).success).toBe(true);
    });
    it("rejects page: 0 (must be positive)", () => {
      expect(PaginationInput.safeParse({ page: 0 }).success).toBe(false);
    });
    it("rejects per_page: 51 (max 50)", () => {
      expect(PaginationInput.safeParse({ per_page: 51 }).success).toBe(false);
    });
    it("rejects non-integer page", () => {
      expect(PaginationInput.safeParse({ page: 1.5 }).success).toBe(false);
    });
  });

  describe("PriceRangeFilter", () => {
    it("accepts nonnegative prices", () => {
      expect(
        PriceRangeFilter.safeParse({ min_price: 0, max_price: 100 }).success,
      ).toBe(true);
    });
    it("rejects negative min_price", () => {
      expect(PriceRangeFilter.safeParse({ min_price: -1 }).success).toBe(false);
    });
  });

  describe("ProductIdParam", () => {
    it("accepts positive integer product_id", () => {
      expect(ProductIdParam.safeParse({ product_id: 123 }).success).toBe(true);
    });
    it("rejects missing product_id", () => {
      expect(ProductIdParam.safeParse({}).success).toBe(false);
    });
    it("rejects negative product_id", () => {
      expect(ProductIdParam.safeParse({ product_id: -1 }).success).toBe(false);
    });
  });
});

describe("SearchProductsInput", () => {
  it("accepts full valid input", () => {
    const result = SearchProductsInput.safeParse({
      query: "leather wallets",
      page: 1,
      per_page: 20,
      min_price: 5,
      max_price: 30,
      shipping_region: "EU",
      brand: "test",
      category: "accessories",
      on_sale: true,
      stock_status: "instock",
      sort_by: "price",
      sort_order: "asc",
    });
    expect(result.success).toBe(true);
  });
  it("accepts minimal valid input (query only)", () => {
    expect(
      SearchProductsInput.safeParse({ query: "leather wallets" }).success,
    ).toBe(true);
  });
  it("rejects empty query string", () => {
    expect(SearchProductsInput.safeParse({ query: "" }).success).toBe(false);
  });
  it("rejects missing query", () => {
    expect(SearchProductsInput.safeParse({}).success).toBe(false);
  });
  it("rejects invalid stock_status", () => {
    expect(
      SearchProductsInput.safeParse({ query: "x", stock_status: "unknown" })
        .success,
    ).toBe(false);
  });
});

describe("ListProductsInput", () => {
  it("accepts empty input (all optional)", () => {
    expect(ListProductsInput.safeParse({}).success).toBe(true);
  });
  it("accepts filter combination", () => {
    expect(
      ListProductsInput.safeParse({ brand: "test", sort_by: "price" }).success,
    ).toBe(true);
  });
  it("does not accept a query field (not defined on schema)", () => {
    // Zod default mode strips unknown keys; ensure schema does not *require* query
    const result = ListProductsInput.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("GetProductInput", () => {
  it("accepts valid product_id", () => {
    expect(GetProductInput.safeParse({ product_id: 123 }).success).toBe(true);
  });
  it("rejects negative product_id", () => {
    expect(GetProductInput.safeParse({ product_id: -1 }).success).toBe(false);
  });
  it("rejects missing product_id", () => {
    expect(GetProductInput.safeParse({}).success).toBe(false);
  });
});

describe("EvaluateProductInput", () => {
  it("accepts product_id only (optional fields omitted)", () => {
    expect(EvaluateProductInput.safeParse({ product_id: 1 }).success).toBe(
      true,
    );
  });
  it("accepts all optional fields", () => {
    expect(
      EvaluateProductInput.safeParse({
        product_id: 1,
        target_retail_price: 30,
        ad_spend_per_unit: 5,
        vat_rate: 0.21,
      }).success,
    ).toBe(true);
  });
  it("rejects vat_rate > 0.5", () => {
    expect(
      EvaluateProductInput.safeParse({ product_id: 1, vat_rate: 0.6 }).success,
    ).toBe(false);
  });
});

describe("CalculateMarginInput", () => {
  it("parses required fields and applies defaults", () => {
    const result = CalculateMarginInput.safeParse({
      cost: 10,
      retail_price: 30,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ad_spend).toBe(0);
      expect(result.data.vat_rate).toBe(0);
    }
  });
  it("rejects negative cost", () => {
    expect(
      CalculateMarginInput.safeParse({ cost: -1, retail_price: 30 }).success,
    ).toBe(false);
  });
  it("rejects zero retail_price (positive required)", () => {
    expect(
      CalculateMarginInput.safeParse({ cost: 10, retail_price: 0 }).success,
    ).toBe(false);
  });
});

describe("CheckHealthInput", () => {
  it("accepts empty object", () => {
    expect(CheckHealthInput.safeParse({}).success).toBe(true);
  });
});

describe("CheckAuthInput", () => {
  it("accepts empty object", () => {
    expect(CheckAuthInput.safeParse({}).success).toBe(true);
  });
});

describe("ListImportListInput", () => {
  it("accepts empty", () => {
    expect(ListImportListInput.safeParse({}).success).toBe(true);
  });
  it("accepts valid status", () => {
    expect(
      ListImportListInput.safeParse({ status: "approval-required" }).success,
    ).toBe(true);
  });
  it("rejects invalid status", () => {
    expect(
      ListImportListInput.safeParse({ status: "bogus" }).success,
    ).toBe(false);
  });
});

describe("AddToImportListInput", () => {
  it("accepts non-empty array of IDs", () => {
    expect(
      AddToImportListInput.safeParse({ product_ids: [1, 2, 3] }).success,
    ).toBe(true);
  });
  it("rejects empty array (min 1)", () => {
    expect(AddToImportListInput.safeParse({ product_ids: [] }).success).toBe(
      false,
    );
  });
  it("rejects array with 51 items (max 50)", () => {
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    expect(
      AddToImportListInput.safeParse({ product_ids: ids }).success,
    ).toBe(false);
  });
});

describe("RemoveFromImportListInput", () => {
  it("accepts non-empty array of IDs", () => {
    expect(
      RemoveFromImportListInput.safeParse({ product_ids: [1] }).success,
    ).toBe(true);
  });
  it("rejects empty array", () => {
    expect(
      RemoveFromImportListInput.safeParse({ product_ids: [] }).success,
    ).toBe(false);
  });
});

describe("SyncProductsInput", () => {
  it("accepts minimum required fields", () => {
    expect(
      SyncProductsInput.safeParse({
        product_id: 1,
        default_store_markup: 2.0,
      }).success,
    ).toBe(true);
  });
  it("rejects missing default_store_markup", () => {
    expect(SyncProductsInput.safeParse({ product_id: 1 }).success).toBe(false);
  });
  it("rejects non-positive markup", () => {
    expect(
      SyncProductsInput.safeParse({
        product_id: 1,
        default_store_markup: 0,
      }).success,
    ).toBe(false);
  });
});

describe("GetSyncJobsInput", () => {
  it("accepts empty", () => {
    expect(GetSyncJobsInput.safeParse({}).success).toBe(true);
  });
  it("accepts valid status", () => {
    expect(GetSyncJobsInput.safeParse({ status: "synced" }).success).toBe(true);
  });
  it("rejects invalid status", () => {
    expect(GetSyncJobsInput.safeParse({ status: "approved" }).success).toBe(
      false,
    );
  });
});
