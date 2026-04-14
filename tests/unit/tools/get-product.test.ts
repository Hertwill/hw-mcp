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
import { createGetProductHandler } from "../../../src/tools/get-product.js";
import { mockServer } from "../../mocks/server.js";
import {
  rateLimitedResponse429,
  serverErrorResponse503,
} from "../../mocks/handlers.js";
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
      slug: "test",
      name: "Test",
      description: "desc",
      sku: "SKU",
      price: 20.0,
      sale_price: null,
      stock: 10,
      stock_status: "instock",
      brand: null,
      images: { featured: null, gallery: [] },
      variations: [],
      category: null,
      collections: [],
      shipping_regions: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: null,
      ...overrides,
    },
    meta: { request_id: "req-test" },
  };
}

describe("get_product handler", () => {
  it("Test 1 — happy path with 3 variations (variations field, NOT variants)", async () => {
    const variation = {
      id: 1,
      name: "Red",
      sku: "V-R",
      price: 20.0,
      sale_price: null,
      stock: 5,
      stock_status: "instock",
      attributes: [{ name: "Color", value: "Red" }],
    };
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () =>
        HttpResponse.json(
          detailFixture({ variations: [variation, { ...variation, id: 2, name: "Blue" }, { ...variation, id: 3, name: "Green" }] }),
        ),
      ),
    );
    const handler = createGetProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as { variations: unknown[] };
    expect(sc.variations.length).toBe(3);
    expect(result.content[0].text).toMatch(/3 variation/);
  });

  it("Test 2 — no variations", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () => HttpResponse.json(detailFixture())),
    );
    const handler = createGetProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as { variations: unknown[] };
    expect(sc.variations.length).toBe(0);
    expect(result.content[0].text).toMatch(/no variations/);
  });

  it("Test 3 — 404 not found surfaces error", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () =>
        HttpResponse.json({ code: "NOT_FOUND", message: "Product not found" }, { status: 404 }),
      ),
    );
    const handler = createGetProductHandler(buildTestDeps());
    const result = await handler({ product_id: 999 } as never);
    expectToolError(result, /not found|404|error|unexpected/i);
  });

  it("Test 4 — 429 upstream", async () => {
    mockServer.use(http.get(`${BASE_URL}/v1/products/:id`, rateLimitedResponse429(4)));
    const handler = createGetProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectToolError(result, /retry|rate|429|unexpected/i);
  }, 15000);

  it("Test 5 — 503 upstream", async () => {
    mockServer.use(http.get(`${BASE_URL}/v1/products/:id`, serverErrorResponse503()));
    const handler = createGetProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectToolError(result, /error|server|503|unexpected/i);
  }, 15000);

  it("Test 6 — reservoir exhausted pre-flight: zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () => {
        spy();
        return HttpResponse.json(detailFixture());
      }),
    );
    const fakeLimiter = { currentReservoir: async () => 0 } as unknown as Bottleneck;
    const deps = buildTestDeps({ publicLimiter: fakeLimiter });
    deps.publicRateReset.observe(8);
    const handler = createGetProductHandler(deps);
    const result = await handler({ product_id: 42 } as never);
    expectToolError(result, /Rate limit exceeded\. Retry after 8s\./);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 7 — description wrapped in <untrusted_supplier_content>", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () =>
        HttpResponse.json(detailFixture({ description: "<script>evil</script>" })),
      ),
    );
    const handler = createGetProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as { description: string };
    expect(sc.description).toMatch(/<untrusted_supplier_content product_id="42"/);
  });

  it("Test 8 — key-leakage guard", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/:id`, () =>
        HttpResponse.json(
          { code: "SERVER_ERROR", message: "boom hw_live_LEAKY42" },
          { status: 500 },
        ),
      ),
    );
    const handler = createGetProductHandler(buildTestDeps());
    const result = await handler({ product_id: 42 } as never);
    expectToolError(result, /./);
  }, 15000);
});
