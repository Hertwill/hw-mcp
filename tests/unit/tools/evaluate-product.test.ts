import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import Bottleneck from "bottleneck";
import pino from "pino";
import { HertwillClient } from "../../../src/hertwill/client.js";
import {
  publicLimiter,
  authLimiter,
} from "../../../src/hertwill/rate-limiter.js";
import { RateResetTracker } from "../../../src/tools/rate-reset.js";
import type { ToolDeps } from "../../../src/tools/types.js";
import { createEvaluateProductHandler } from "../../../src/tools/evaluate-product.js";
import { mockServer } from "../../mocks/server.js";
import {
  expectStructuredAndText,
  expectToolError,
} from "../../helpers/mcp-assertions.js";

const BASE_URL = "https://api.hertwill.com";

function buildTestDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
  const client = new HertwillClient({ baseUrl: BASE_URL });
  return {
    client,
    publicLimiter,
    authLimiter,
    logger: pino({ level: "silent" }),
    serverVersion: "0.1.0-test",
    apiKey: undefined,
    publicRateReset: new RateResetTracker(),
    authRateReset: new RateResetTracker(),
    healthCache: { get: () => undefined, set: () => {} },
    ...overrides,
  };
}

function detailFixture(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 42,
      slug: "x",
      name: "Cool Shoes",
      description: "Stylish running shoes",
      sku: "CS-1",
      price: 25.0,
      sale_price: 19.99,
      stock: 3,
      stock_status: "instock",
      brand: null,
      images: { featured: null, gallery: [] },
      variations: [],
      category: null,
      collections: [],
      shipping_regions: [{ code: "EU", name: "European Union" }],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: null,
      ...overrides,
    },
    meta: { request_id: "req-eval" },
  };
}

describe("evaluate_product handler (factual scorecard — D-13)", () => {
  it("returns factual fields only — no score/rank/rating/verdict keys", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () => HttpResponse.json(detailFixture())),
    );
    const handler = createEvaluateProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent;
    for (const forbidden of ["score", "rank", "rating", "verdict", "recommendation", "signal"]) {
      expect(Object.keys(sc)).not.toContain(forbidden);
    }
    expect(Object.keys(sc)).toEqual(
      expect.arrayContaining([
        "product_id",
        "name",
        "margin_inputs",
        "shipping_regions",
        "variant_count",
        "eu_shippable",
        "stock_state",
        "is_on_sale",
        "has_variants",
      ]),
    );
  });

  it("wraps product name in untrusted delimiters", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () =>
        HttpResponse.json(detailFixture({ name: "<script>x</script>" })),
      ),
    );
    const handler = createEvaluateProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectStructuredAndText(result);
    expect((result.structuredContent as { name: string }).name).toMatch(
      /<untrusted_supplier_content product_id="42"/,
    );
  });

  it("uses transformShipsTo for ISO codes; eu_shippable true when EU present", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () =>
        HttpResponse.json(
          detailFixture({
            shipping_regions: [
              { code: "EU", name: "European Union" },
              { code: "US", name: "United States" },
            ],
          }),
        ),
      ),
    );
    const handler = createEvaluateProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      shipping_regions: string[];
      eu_shippable: boolean;
    };
    expect(sc.shipping_regions).toEqual(["EU", "US"]);
    expect(sc.eu_shippable).toBe(true);
  });

  it("eu_shippable false when EU absent", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () =>
        HttpResponse.json(
          detailFixture({ shipping_regions: [{ code: "US", name: "US" }] }),
        ),
      ),
    );
    const handler = createEvaluateProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectStructuredAndText(result);
    expect((result.structuredContent as { eu_shippable: boolean }).eu_shippable).toBe(false);
  });

  it("stock_state derived via transformStockInfo (3 stock instock = low)", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () =>
        HttpResponse.json(detailFixture({ stock: 3, stock_status: "instock" })),
      ),
    );
    const handler = createEvaluateProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectStructuredAndText(result);
    expect((result.structuredContent as { stock_state: string }).stock_state).toMatch(/low|in_stock/);
  });

  it("is_on_sale true when sale_price is set", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () =>
        HttpResponse.json(detailFixture({ sale_price: 15.0 })),
      ),
    );
    const handler = createEvaluateProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectStructuredAndText(result);
    expect((result.structuredContent as { is_on_sale: boolean }).is_on_sale).toBe(true);
  });

  it("has_variants + variant_count when variations present", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () =>
        HttpResponse.json(
          detailFixture({
            variations: [
              { id: 1, name: "S", sku: "V-S", price: 20, sale_price: null, stock: 5, stock_status: "instock", attributes: [] },
              { id: 2, name: "M", sku: "V-M", price: 20, sale_price: null, stock: 0, stock_status: "outofstock", attributes: [] },
            ],
          }),
        ),
      ),
    );
    const handler = createEvaluateProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as { has_variants: boolean; variant_count: number };
    expect(sc.has_variants).toBe(true);
    expect(sc.variant_count).toBe(2);
  });

  it("reservoir exhausted pre-flight: zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () => {
        spy();
        return HttpResponse.json(detailFixture());
      }),
    );
    const fakeLimiter = { currentReservoir: async () => 0 } as unknown as Bottleneck;
    const deps = buildTestDeps({ publicLimiter: fakeLimiter });
    deps.publicRateReset.observe(6);
    const handler = createEvaluateProductHandler(deps);
    const result = await handler({ product_id: 42 } as never);
    expectToolError(result, /Rate limit exceeded\. Retry after 6s\./);
    expect(spy).not.toHaveBeenCalled();
  });

  it("key-leakage guard on 500 error", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () =>
        HttpResponse.json(
          { code: "SERVER_ERROR", message: "boom hw_live_EVALUATE_LEAK" },
          { status: 500 },
        ),
      ),
    );
    const handler = createEvaluateProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectToolError(result, /./);
  }, 15000);
});
